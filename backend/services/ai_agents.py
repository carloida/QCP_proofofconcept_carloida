from __future__ import annotations

import sqlite3
import time
from datetime import date
from typing import Any

from models import Actor, GstTreatment
from services.ai_client import get_ai_settings, run_structured_json
from services.ai_usage import record_ai_usage
from services.audit_service import write_audit
from services.classification_service import classify_transaction
from services.reconciliation_service import generate_exceptions


INGESTION_AGENT = "ingestion_data_quality"
CLASSIFICATION_AGENT = "gst_treatment_classification"

UI_TO_MODEL_TREATMENT = {
    "standard_rated": GstTreatment.STANDARD_RATED_SUPPLY.value,
    "zero_rated": GstTreatment.ZERO_RATED_SUPPLY.value,
    "exempt": GstTreatment.EXEMPT_SUPPLY.value,
    "out_of_scope": GstTreatment.OUT_OF_SCOPE_SUPPLY.value,
    "taxable_purchase": GstTreatment.TAXABLE_PURCHASE.value,
    "non_claimable_input_tax": GstTreatment.DISALLOWED_INPUT_TAX.value,
    "reverse_charge": GstTreatment.REVERSE_CHARGE.value,
    "needs_review": GstTreatment.REVIEW_REQUIRED.value,
}


def _usage_dict(prompt_tokens: int = 0, completion_tokens: int = 0, total_tokens: int = 0) -> dict:
    return {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens,
    }


def _rows_for_period(conn: sqlite3.Connection, filing_period_id: int) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM transactions WHERE filing_period_id = ? ORDER BY transaction_date, id",
        (filing_period_id,),
    ).fetchall()
    return [dict(row) for row in rows]


def _period_payload(period: sqlite3.Row) -> dict:
    return {
        "id": period["id"],
        "name": period["name"],
        "start_date": period["start_date"],
        "end_date": period["end_date"],
    }


def _safe_records(records: list[dict]) -> list[dict]:
    safe = []
    for row in records:
        safe.append(
            {
                "transaction_id": str(row["id"]),
                "transaction_date": row["transaction_date"],
                "invoice_no": row.get("invoice_no") or "",
                "source_system": row.get("source_system") or "",
                "transaction_type": row.get("transaction_type") or "",
                "counterparty_country": row.get("counterparty_country") or "",
                "gl_account": row.get("gl_account") or "",
                "description": row.get("description") or "",
                "currency": row.get("currency") or "SGD",
                "net_amount": float(row.get("net_amount") or 0),
                "gst_amount": float(row.get("gst_amount") or 0),
                "gross_amount": float(row.get("gross_amount") or 0),
                "original_tax_code": row.get("original_tax_code") or "",
                "current_gst_treatment": row.get("gst_treatment") or "",
            }
        )
    return safe


def _fallback_quality_findings(period: sqlite3.Row, records: list[dict]) -> list[dict]:
    start = date.fromisoformat(period["start_date"])
    end = date.fromisoformat(period["end_date"])
    invoice_counts: dict[str, int] = {}
    for row in records:
        invoice = str(row.get("invoice_no") or "").strip().upper()
        if invoice:
            invoice_counts[invoice] = invoice_counts.get(invoice, 0) + 1

    findings = []
    for row in records:
        tx_date = date.fromisoformat(row["transaction_date"])
        issues: list[tuple[str, str, str, bool]] = []
        invoice = str(row.get("invoice_no") or "").strip()
        counterparty = str(row.get("counterparty_name") or "").strip()
        currency = str(row.get("currency") or "SGD").strip().upper()
        net = float(row.get("net_amount") or 0)
        gst = float(row.get("gst_amount") or 0)
        gross = float(row.get("gross_amount") or 0)

        if tx_date < start or tx_date > end:
            issues.append(("out_of_period_date", "transaction_date", "Transaction date falls outside the reporting period.", True))
        if not invoice:
            issues.append(("missing_invoice_no", "invoice_no", "Invoice number is missing or malformed.", True))
        elif invoice_counts.get(invoice.upper(), 0) > 1:
            issues.append(("possible_duplicate_invoice", "invoice_no", "Invoice number appears more than once in this period.", True))
        if not counterparty:
            issues.append(("missing_counterparty", "counterparty_name", "Supplier or customer name is missing.", True))
        if currency != "SGD":
            issues.append(("missing_fx_support", "currency", "Non-SGD transaction requires SGD conversion support.", True))
        if net < 0 or gst < 0 or gross < 0:
            issues.append(("negative_amount", "net_amount", "Negative or credit-note amount requires accountant review.", True))
        if abs(round(net + gst - gross, 2)) > 1:
            issues.append(("net_gst_gross_mismatch", "gross_amount", "Net plus GST does not reconcile to gross amount.", True))

        if not issues:
            findings.append(
                {
                    "transaction_id": str(row["id"]),
                    "data_quality_status": "clean",
                    "issue_type": "none",
                    "field": "none",
                    "reason": "No deterministic data quality issue detected.",
                    "suggested_action": "Continue to GST treatment classification.",
                    "confidence_score": 0.9,
                    "human_correction_required": False,
                }
            )
            continue

        for issue_type, field, reason, human_required in issues:
            findings.append(
                {
                    "transaction_id": str(row["id"]),
                    "data_quality_status": "needs_human_correction" if human_required else "warning",
                    "issue_type": issue_type,
                    "field": field,
                    "reason": reason,
                    "suggested_action": "Review and correct the source record before relying on the filing output.",
                    "confidence_score": 0.88,
                    "human_correction_required": human_required,
                }
            )
    return findings


def _quality_summary(records: list[dict], findings: list[dict]) -> dict:
    record_ids = {str(row["id"]) for row in records}
    status_by_id = {record_id: "clean" for record_id in record_ids}
    for finding in findings:
        record_id = str(finding["transaction_id"])
        status = finding["data_quality_status"]
        if status == "blocked":
            status_by_id[record_id] = "blocked"
        elif status == "needs_human_correction" and status_by_id.get(record_id) != "blocked":
            status_by_id[record_id] = "needs_human_correction"
        elif status == "warning" and status_by_id.get(record_id) == "clean":
            status_by_id[record_id] = "warning"
    return {
        "records_reviewed": len(records),
        "clean_records": sum(1 for status in status_by_id.values() if status == "clean"),
        "warnings": sum(1 for status in status_by_id.values() if status == "warning"),
        "human_corrections_required": sum(1 for status in status_by_id.values() if status == "needs_human_correction"),
        "blocked_records": sum(1 for status in status_by_id.values() if status == "blocked"),
    }


QUALITY_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "findings": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "transaction_id": {"type": "string"},
                    "data_quality_status": {"type": "string", "enum": ["clean", "warning", "needs_human_correction", "blocked"]},
                    "issue_type": {"type": "string"},
                    "field": {"type": "string"},
                    "reason": {"type": "string"},
                    "suggested_action": {"type": "string"},
                    "confidence_score": {"type": "number"},
                    "human_correction_required": {"type": "boolean"},
                },
                "required": [
                    "transaction_id",
                    "data_quality_status",
                    "issue_type",
                    "field",
                    "reason",
                    "suggested_action",
                    "confidence_score",
                    "human_correction_required",
                ],
            },
        }
    },
    "required": ["findings"],
}


CLASSIFICATION_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "classifications": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "transaction_id": {"type": "string"},
                    "recommended_gst_treatment": {
                        "type": "string",
                        "enum": [
                            "standard_rated",
                            "zero_rated",
                            "exempt",
                            "out_of_scope",
                            "taxable_purchase",
                            "non_claimable_input_tax",
                            "reverse_charge",
                            "needs_review",
                        ],
                    },
                    "confidence_score": {"type": "number"},
                    "reason": {"type": "string"},
                    "review_required": {"type": "boolean"},
                    "risk_flags": {"type": "array", "items": {"type": "string"}},
                    "evidence_required": {"type": "string"},
                    "suggested_f5_box_impact": {"type": "array", "items": {"type": "string"}},
                },
                "required": [
                    "transaction_id",
                    "recommended_gst_treatment",
                    "confidence_score",
                    "reason",
                    "review_required",
                    "risk_flags",
                    "evidence_required",
                    "suggested_f5_box_impact",
                ],
            },
        }
    },
    "required": ["classifications"],
}


def run_ingestion_quality_review(conn: sqlite3.Connection, period: sqlite3.Row) -> dict:
    filing_period_id = int(period["id"])
    records = _rows_for_period(conn, filing_period_id)
    settings = get_ai_settings()
    write_audit(conn, filing_period_id, Actor.SYSTEM, "AI_INGESTION_QUALITY_REVIEW_STARTED", "Ingestion & Data Quality Agent started structured review.", affected_item="ai_agent:ingestion_data_quality")

    fallback_used = False
    status = "completed"
    usage = _usage_dict()
    model = settings.model
    latency_ms = 0
    try:
        if not settings.ready:
            raise RuntimeError("AI API key is not configured")
        last_validation_error: Exception | None = None
        for attempt in range(2):
            call = run_structured_json(
                schema_name="ingestion_quality_review",
                schema=QUALITY_SCHEMA,
                system_prompt=(
                    "You are an AI-assisted ingestion data quality reviewer for Singapore GST F5 preparation. "
                    "Review parsed structured records only. Do not mutate records. Do not invent missing evidence. "
                    "Return only schema-valid JSON. Mark uncertain or risky records as requiring human correction. "
                    + ("This is a retry after validation failure. Follow the schema exactly and classify every relevant issue." if attempt else "")
                ),
                user_payload={
                    "reporting_period": _period_payload(period),
                    "records": _safe_records(records),
                    "rules": [
                        "Flag out-of-period dates, missing invoice numbers, missing counterparties, non-SGD currency support, negative amounts, and net/GST/gross mismatches.",
                        "Use clean only when no human correction or warning is needed.",
                    ],
                },
            )
            try:
                findings = _validate_quality_findings(call.data.get("findings", []), records)
                break
            except Exception as exc:
                last_validation_error = exc
                if attempt == 0:
                    write_audit(conn, filing_period_id, Actor.SYSTEM, "AI_RESPONSE_VALIDATION_FAILED", f"Ingestion quality AI response failed validation and will be retried. {exc}", affected_item="ai_agent:ingestion_data_quality")
                else:
                    raise last_validation_error
        usage = _usage_dict(call.prompt_tokens, call.completion_tokens, call.total_tokens)
        model = call.model
        latency_ms = call.latency_ms
    except Exception as exc:
        fallback_used = True
        status = "fallback"
        started = time.perf_counter()
        findings = _fallback_quality_findings(period, records)
        latency_ms = int((time.perf_counter() - started) * 1000)
        write_audit(conn, filing_period_id, Actor.SYSTEM, "AI_FALLBACK_USED", f"Ingestion quality review used deterministic fallback. {exc}", affected_item="ai_agent:ingestion_data_quality")

    summary = _quality_summary(records, findings)
    usage_event = record_ai_usage(
        conn,
        period_id=filing_period_id,
        agent_name=INGESTION_AGENT,
        model=model,
        prompt_tokens=usage["prompt_tokens"],
        completion_tokens=usage["completion_tokens"],
        total_tokens=usage["total_tokens"],
        latency_ms=latency_ms,
        status=status,
        fallback_used=fallback_used,
    )
    write_audit(conn, filing_period_id, Actor.SYSTEM, "TOKEN_USAGE_RECORDED", f"{INGESTION_AGENT} used {usage['total_tokens']} tokens.", affected_item="ai_usage")
    write_audit(conn, filing_period_id, Actor.SYSTEM, "AI_INGESTION_QUALITY_REVIEW_COMPLETED", f"Reviewed {summary['records_reviewed']} records; {summary['human_corrections_required']} require human correction.", affected_item="ai_agent:ingestion_data_quality")
    return {
        "agent": INGESTION_AGENT,
        "model": model,
        "status": status,
        "ai_fallback": fallback_used,
        "summary": summary,
        "findings": findings,
        "usage": usage,
        "usage_event": usage_event,
    }


def _validate_quality_findings(findings: Any, records: list[dict]) -> list[dict]:
    record_ids = {str(row["id"]) for row in records}
    if not isinstance(findings, list):
        raise ValueError("AI quality findings must be a list")
    validated = []
    for item in findings:
        if not isinstance(item, dict) or str(item.get("transaction_id")) not in record_ids:
            continue
        status = item.get("data_quality_status")
        if status not in {"clean", "warning", "needs_human_correction", "blocked"}:
            raise ValueError("Invalid data quality status")
        confidence = float(item.get("confidence_score", 0))
        validated.append(
            {
                "transaction_id": str(item["transaction_id"]),
                "data_quality_status": status,
                "issue_type": str(item.get("issue_type") or "unspecified"),
                "field": str(item.get("field") or "unspecified"),
                "reason": str(item.get("reason") or "AI-assisted review found a data quality issue."),
                "suggested_action": str(item.get("suggested_action") or "Route to human correction."),
                "confidence_score": max(0, min(1, confidence)),
                "human_correction_required": bool(item.get("human_correction_required")),
            }
        )
    if not validated and records:
        raise ValueError("AI did not return usable data quality findings")
    return validated


def _fallback_classifications(records: list[dict]) -> list[dict]:
    classifications = []
    for row in records:
        result = classify_transaction(row)
        ui_treatment = next(
            (key for key, value in UI_TO_MODEL_TREATMENT.items() if value == result.treatment.value),
            "needs_review",
        )
        confidence = float(result.confidence)
        classifications.append(
            {
                "transaction_id": str(row["id"]),
                "recommended_gst_treatment": ui_treatment,
                "confidence_score": confidence,
                "reason": result.reason,
                "review_required": confidence < 0.8 or result.treatment in {GstTreatment.REVIEW_REQUIRED, GstTreatment.REVERSE_CHARGE, GstTreatment.DISALLOWED_INPUT_TAX},
                "risk_flags": ["deterministic_fallback"] if confidence < 0.8 else [],
                "evidence_required": _evidence_required(ui_treatment, row),
                "suggested_f5_box_impact": _box_impact(ui_treatment),
            }
        )
    return classifications


def _evidence_required(ui_treatment: str, row: dict) -> str:
    if ui_treatment == "zero_rated":
        return "export_evidence"
    if ui_treatment in {"taxable_purchase", "non_claimable_input_tax"}:
        return "tax_invoice_or_import_permit"
    if ui_treatment == "reverse_charge":
        return "imported_service_support"
    return "tax_invoice"


def _box_impact(ui_treatment: str) -> list[str]:
    return {
        "standard_rated": ["Box 1", "Box 6"],
        "zero_rated": ["Box 2"],
        "exempt": ["Box 3"],
        "taxable_purchase": ["Box 5", "Box 7"],
        "reverse_charge": ["Box 6", "Box 7"],
        "non_claimable_input_tax": ["Box 5"],
        "out_of_scope": ["excluded_from_f5"],
        "needs_review": ["needs_human_review"],
    }.get(ui_treatment, ["needs_human_review"])


def _force_risk_review(item: dict, row: dict) -> dict:
    confidence = float(item["confidence_score"])
    treatment = item["recommended_gst_treatment"]
    risk_flags = list(item.get("risk_flags") or [])
    description = str(row.get("description") or "").lower()
    invoice = str(row.get("invoice_no") or "").strip()
    gst = float(row.get("gst_amount") or 0)
    net = abs(float(row.get("net_amount") or 0))
    tax_code = str(row.get("original_tax_code") or "").lower()

    if confidence < 0.8:
        risk_flags.append("low_confidence")
    if treatment == "zero_rated" and "evidence" not in description:
        risk_flags.append("zero_rated_evidence_missing")
    if treatment in {"taxable_purchase", "non_claimable_input_tax"} and not invoice:
        risk_flags.append("tax_invoice_missing")
    if net >= 50000:
        risk_flags.append("high_value_transaction")
    if treatment == "reverse_charge":
        risk_flags.append("reverse_charge_review")
    if treatment in {"exempt", "out_of_scope"} and confidence < 0.9:
        risk_flags.append("ambiguous_exempt_or_out_of_scope")
    if gst < 0:
        risk_flags.append("negative_gst_amount")
    if tax_code and treatment == "standard_rated" and "zr" in tax_code:
        risk_flags.append("source_tax_code_conflict")

    item["risk_flags"] = sorted(set(risk_flags))
    item["review_required"] = bool(item.get("review_required")) or bool(item["risk_flags"])
    return item


def _validate_classifications(classifications: Any, records: list[dict]) -> list[dict]:
    by_id = {str(row["id"]): row for row in records}
    if not isinstance(classifications, list):
        raise ValueError("AI classifications must be a list")
    validated = []
    for item in classifications:
        if not isinstance(item, dict):
            continue
        transaction_id = str(item.get("transaction_id"))
        if transaction_id not in by_id:
            continue
        treatment = item.get("recommended_gst_treatment")
        if treatment not in UI_TO_MODEL_TREATMENT:
            raise ValueError("Invalid GST treatment")
        confidence = max(0, min(1, float(item.get("confidence_score", 0))))
        normalized = {
            "transaction_id": transaction_id,
            "recommended_gst_treatment": treatment,
            "confidence_score": confidence,
            "reason": str(item.get("reason") or "AI-assisted GST treatment recommendation."),
            "review_required": bool(item.get("review_required")) or confidence < 0.8,
            "risk_flags": [str(flag) for flag in (item.get("risk_flags") or [])],
            "evidence_required": str(item.get("evidence_required") or _evidence_required(treatment, by_id[transaction_id])),
            "suggested_f5_box_impact": [str(box) for box in item.get("suggested_f5_box_impact", [])] or _box_impact(treatment),
        }
        validated.append(_force_risk_review(normalized, by_id[transaction_id]))
    if len(validated) != len(records):
        raise ValueError("AI did not classify every transaction")
    return validated


def _classification_summary(classifications: list[dict]) -> dict:
    confidences = [float(item["confidence_score"]) for item in classifications]
    return {
        "transactions_classified": len(classifications),
        "low_confidence_count": sum(1 for confidence in confidences if confidence < 0.8),
        "review_required_count": sum(1 for item in classifications if item["review_required"]),
        "average_confidence": round(sum(confidences) / len(confidences), 2) if confidences else 0,
    }


def run_gst_classification(conn: sqlite3.Connection, period: sqlite3.Row) -> dict:
    filing_period_id = int(period["id"])
    records = _rows_for_period(conn, filing_period_id)
    settings = get_ai_settings()
    write_audit(conn, filing_period_id, Actor.SYSTEM, "AI_GST_CLASSIFICATION_STARTED", "GST Treatment Classification Agent started recommendations.", affected_item="ai_agent:gst_treatment_classification")

    fallback_used = False
    status = "completed"
    usage = _usage_dict()
    model = settings.model
    latency_ms = 0
    try:
        if not settings.ready:
            raise RuntimeError("AI API key is not configured")
        last_validation_error = None
        for attempt in range(2):
            call = run_structured_json(
                schema_name="gst_treatment_classification",
                schema=CLASSIFICATION_SCHEMA,
                system_prompt=(
                    "You are an AI-assisted GST treatment classification agent for Singapore GST F5 preparation. "
                    "Recommend GST treatment and human review routing only. Do not provide final tax advice. "
                    "Do not invent evidence. Mark uncertain, high-risk, evidence-dependent, reverse-charge, or low-confidence cases for human review. "
                    + ("This is a retry after validation failure. Follow the schema exactly and classify every transaction." if attempt else "")
                ),
                user_payload={
                    "reporting_period": _period_payload(period),
                    "transactions": _safe_records(records),
                    "treatments": list(UI_TO_MODEL_TREATMENT.keys()),
                    "f5_impacts": ["Box 1", "Box 2", "Box 3", "Box 5", "Box 6", "Box 7", "excluded_from_f5", "needs_human_review"],
                },
            )
            try:
                classifications = _validate_classifications(call.data.get("classifications", []), records)
                break
            except Exception as exc:
                last_validation_error = exc
                if attempt == 0:
                    write_audit(conn, filing_period_id, Actor.SYSTEM, "AI_RESPONSE_VALIDATION_FAILED", f"GST classification AI response failed validation and will be retried. {exc}", affected_item="ai_agent:gst_treatment_classification")
                else:
                    raise last_validation_error
        usage = _usage_dict(call.prompt_tokens, call.completion_tokens, call.total_tokens)
        model = call.model
        latency_ms = call.latency_ms
    except Exception as exc:
        fallback_used = True
        status = "fallback"
        started = time.perf_counter()
        classifications = _fallback_classifications(records)
        latency_ms = int((time.perf_counter() - started) * 1000)
        write_audit(conn, filing_period_id, Actor.SYSTEM, "AI_FALLBACK_USED", f"GST classification used deterministic fallback. {exc}", affected_item="ai_agent:gst_treatment_classification")

    for item in classifications:
        transaction_id = int(item["transaction_id"])
        treatment = UI_TO_MODEL_TREATMENT[item["recommended_gst_treatment"]]
        review_status = "NEEDS_REVIEW" if item["review_required"] else "AUTO_CLASSIFIED"
        reason = f"AI-assisted recommendation: {item['reason']} Evidence required: {item['evidence_required']}."
        conn.execute(
            """
            UPDATE transactions
            SET gst_treatment = ?, classification_confidence = ?, classification_reason = ?,
                review_status = ?, anomaly_score = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND filing_period_id = ?
            """,
            (
                treatment,
                float(item["confidence_score"]),
                reason,
                review_status,
                round(1 - float(item["confidence_score"]), 2),
                transaction_id,
                filing_period_id,
            ),
        )
        if item["review_required"]:
            write_audit(conn, filing_period_id, Actor.SYSTEM, "LOW_CONFIDENCE_CLASSIFICATION_ROUTED_TO_HUMAN_REVIEW", f"Transaction {transaction_id} routed for human review. Flags: {', '.join(item['risk_flags']) or 'review required'}.", transaction_id, affected_item=f"transaction:{transaction_id}", step="Step 3: GST Treatment Classification")

    start_date = date.fromisoformat(period["start_date"])
    end_date = date.fromisoformat(period["end_date"])
    generate_exceptions(conn, filing_period_id, start_date, end_date)

    summary = _classification_summary(classifications)
    usage_event = record_ai_usage(
        conn,
        period_id=filing_period_id,
        agent_name=CLASSIFICATION_AGENT,
        model=model,
        prompt_tokens=usage["prompt_tokens"],
        completion_tokens=usage["completion_tokens"],
        total_tokens=usage["total_tokens"],
        latency_ms=latency_ms,
        status=status,
        fallback_used=fallback_used,
    )
    write_audit(conn, filing_period_id, Actor.SYSTEM, "TOKEN_USAGE_RECORDED", f"{CLASSIFICATION_AGENT} used {usage['total_tokens']} tokens.", affected_item="ai_usage")
    write_audit(conn, filing_period_id, Actor.SYSTEM, "AI_GST_CLASSIFICATION_COMPLETED", f"Classified {summary['transactions_classified']} transactions; {summary['review_required_count']} require human review.", affected_item="ai_agent:gst_treatment_classification")
    return {
        "agent": CLASSIFICATION_AGENT,
        "model": model,
        "status": status,
        "ai_fallback": fallback_used,
        "summary": summary,
        "classifications": classifications,
        "usage": usage,
        "usage_event": usage_event,
    }
