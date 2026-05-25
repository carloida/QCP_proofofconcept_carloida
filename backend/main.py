from __future__ import annotations

from datetime import date, datetime, timezone
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from database import get_connection, init_db, row_to_dict
from models import Actor
from schemas import ApprovalRequest, ExceptionStatusRequest, FilingPeriod, FilingPeriodCreate, OverrideRequest
from services.audit_service import write_audit
from services.export_service import audit_csv, exceptions_csv, gst_f5_json, transactions_csv
from services.gst_f5_service import compute_summary
from services.ingestion_service import ingest_csv
from services.reconciliation_service import generate_exceptions

app = FastAPI(title="GST F5 Compliance Agent Prototype")
SAMPLE_DATA_PATH = Path(__file__).resolve().parent / "sample_data" / "sample_qcp_gst_transactions.csv"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "GST F5 Compliance Agent Prototype"}


@app.post("/api/filing-periods", response_model=FilingPeriod)
def create_filing_period(payload: FilingPeriodCreate):
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="end_date must be on or after start_date")
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO filing_periods (name, start_date, end_date, status)
            VALUES (?, ?, ?, 'DRAFT')
            """,
            (payload.name, payload.start_date.isoformat(), payload.end_date.isoformat()),
        )
        filing_period_id = cursor.lastrowid
        write_audit(conn, filing_period_id, Actor.SYSTEM, "FILING_PERIOD_CREATED", f"Created period {payload.name}.")
        row = conn.execute("SELECT * FROM filing_periods WHERE id = ?", (filing_period_id,)).fetchone()
        return row_to_dict(row)


@app.get("/api/filing-periods")
def list_filing_periods():
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM filing_periods ORDER BY created_at DESC").fetchall()
        return [dict(row) for row in rows]


def _get_period(conn, filing_period_id: int):
    period = conn.execute("SELECT * FROM filing_periods WHERE id = ?", (filing_period_id,)).fetchone()
    if not period:
        raise HTTPException(status_code=404, detail="Filing period not found")
    return period


@app.post("/api/filing-periods/{filing_period_id}/upload")
def upload_transactions(filing_period_id: int, file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload a CSV file")
    with get_connection() as conn:
        period = _get_period(conn, filing_period_id)
        try:
            result = ingest_csv(
                conn,
                filing_period_id,
                file.file,
                date.fromisoformat(period["start_date"]),
                date.fromisoformat(period["end_date"]),
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return result


@app.post("/api/filing-periods/{filing_period_id}/load-sample")
def load_sample_transactions(filing_period_id: int):
    with get_connection() as conn:
        period = _get_period(conn, filing_period_id)
        if not SAMPLE_DATA_PATH.exists():
            raise HTTPException(status_code=404, detail="Sample dataset not found")
        with SAMPLE_DATA_PATH.open("rb") as sample_file:
            result = ingest_csv(
                conn,
                filing_period_id,
                sample_file,
                date.fromisoformat(period["start_date"]),
                date.fromisoformat(period["end_date"]),
            )
        write_audit(
            conn,
            filing_period_id,
            Actor.SYSTEM,
            "SAMPLE_DATASET_LOADED",
            "Sample GST quarter loaded into the canonical transaction pipeline.",
            affected_item="sample_qcp_gst_transactions.csv",
            new_value=f"{result['inserted']} transactions",
            reason="Prototype demonstration data loaded",
            step="Step 1: Data Ingestion Hub",
        )
        return result


@app.get("/api/filing-periods/{filing_period_id}/transactions")
def list_transactions(filing_period_id: int):
    with get_connection() as conn:
        _get_period(conn, filing_period_id)
        rows = conn.execute(
            """
            SELECT
                t.*,
                CASE
                    WHEN SUM(CASE WHEN e.severity = 'HIGH' AND e.resolved = 0 THEN 1 ELSE 0 END) > 0 THEN 'HIGH'
                    WHEN SUM(CASE WHEN e.severity = 'MEDIUM' AND e.resolved = 0 THEN 1 ELSE 0 END) > 0 THEN 'MEDIUM'
                    WHEN SUM(CASE WHEN e.severity = 'LOW' AND e.resolved = 0 THEN 1 ELSE 0 END) > 0 THEN 'LOW'
                    ELSE NULL
                END AS max_exception_severity
            FROM transactions t
            LEFT JOIN reconciliation_exceptions e ON e.transaction_id = t.id
            WHERE t.filing_period_id = ?
            GROUP BY t.id
            ORDER BY t.transaction_date, t.id
            """,
            (filing_period_id,),
        ).fetchall()
        return [dict(row) for row in rows]


@app.patch("/api/transactions/{transaction_id}/override")
def override_transaction(transaction_id: int, payload: OverrideRequest):
    with get_connection() as conn:
        tx = conn.execute("SELECT * FROM transactions WHERE id = ?", (transaction_id,)).fetchone()
        if not tx:
            raise HTTPException(status_code=404, detail="Transaction not found")
        old_treatment = tx["gst_treatment"]
        conn.execute(
            """
            UPDATE transactions
            SET gst_treatment = ?, review_status = 'OVERRIDDEN',
                classification_confidence = 1.0,
                classification_reason = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (payload.new_treatment.value, f"Manual accountant override: {payload.reason}", transaction_id),
        )
        conn.execute(
            """
            INSERT INTO overrides (transaction_id, old_treatment, new_treatment, reason, user_name)
            VALUES (?, ?, ?, ?, ?)
            """,
            (transaction_id, old_treatment, payload.new_treatment.value, payload.reason, payload.user_name),
        )
        period = _get_period(conn, tx["filing_period_id"])
        generate_exceptions(
            conn,
            tx["filing_period_id"],
            date.fromisoformat(period["start_date"]),
            date.fromisoformat(period["end_date"]),
        )
        write_audit(
            conn,
            tx["filing_period_id"],
            Actor.USER,
            "OVERRIDE_APPLIED",
            f"{payload.user_name} changed treatment from {old_treatment} to {payload.new_treatment.value}. Reason: {payload.reason}",
            transaction_id,
            affected_item=f"transaction:{transaction_id}",
            old_value=old_treatment,
            new_value=payload.new_treatment.value,
            reason=payload.reason,
            step="Step 6: Human Review and Approval",
        )
        write_audit(conn, tx["filing_period_id"], Actor.SYSTEM, "GST_F5_RECALCULATED", "Summary recalculated after override.", transaction_id, affected_item="GST F5 boxes", step="Step 5: GST F5 Computation")
        return {"status": "updated", "old_treatment": old_treatment, "new_treatment": payload.new_treatment.value}


@app.post("/api/transactions/{transaction_id}/approve")
def approve_transaction(transaction_id: int, payload: ApprovalRequest):
    with get_connection() as conn:
        tx = conn.execute("SELECT * FROM transactions WHERE id = ?", (transaction_id,)).fetchone()
        if not tx:
            raise HTTPException(status_code=404, detail="Transaction not found")
        old_status = tx["review_status"]
        conn.execute(
            "UPDATE transactions SET review_status = 'APPROVED', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (transaction_id,),
        )
        write_audit(
            conn,
            tx["filing_period_id"],
            Actor.USER,
            "TRANSACTION_REVIEWED_BY_HUMAN",
            f"{payload.user_name} approved GST classification. {payload.comment}",
            transaction_id,
            affected_item=f"transaction:{transaction_id}",
            old_value=old_status,
            new_value="APPROVED",
            reason=payload.comment,
            step="Step 6: Human Review and Approval",
        )
        return {"status": "APPROVED"}


@app.get("/api/filing-periods/{filing_period_id}/exceptions")
def list_exceptions(filing_period_id: int):
    with get_connection() as conn:
        _get_period(conn, filing_period_id)
        rows = conn.execute(
            """
            SELECT e.*, t.invoice_no, t.counterparty_name, t.description, t.net_amount
            FROM reconciliation_exceptions e
            JOIN transactions t ON t.id = e.transaction_id
            WHERE t.filing_period_id = ?
            ORDER BY
                CASE e.severity WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
                e.created_at DESC
            """,
            (filing_period_id,),
        ).fetchall()
        return [dict(row) for row in rows]


@app.patch("/api/exceptions/{exception_id}/status")
def update_exception_status(exception_id: int, payload: ExceptionStatusRequest):
    if payload.status in ("Accepted Risk", "Excluded From Filing") and not payload.comment:
        raise HTTPException(status_code=400, detail="Accepted Risk and Excluded From Filing require a human comment")
    with get_connection() as conn:
        exception = conn.execute(
            """
            SELECT e.*, t.filing_period_id
            FROM reconciliation_exceptions e
            JOIN transactions t ON t.id = e.transaction_id
            WHERE e.id = ?
            """,
            (exception_id,),
        ).fetchone()
        if not exception:
            raise HTTPException(status_code=404, detail="Exception not found")
        conn.execute(
            """
            UPDATE reconciliation_exceptions
            SET status = ?, resolved = ?, resolution_comment = ?
            WHERE id = ?
            """,
            (payload.status, 1 if payload.status in ("Resolved", "Accepted Risk", "Excluded From Filing") else 0, payload.comment, exception_id),
        )
        write_audit(
            conn,
            exception["filing_period_id"],
            Actor.USER,
            "ANOMALY_RESOLVED" if payload.status == "Resolved" else "ANOMALY_STATUS_UPDATED",
            f"Anomaly {exception_id} set to {payload.status}. {payload.comment or ''}".strip(),
            exception["transaction_id"],
            affected_item=f"exception:{exception_id}",
            old_value=exception["status"],
            new_value=payload.status,
            reason=payload.comment,
            step="Step 4: Reconciliation and Anomaly Detection",
        )
        return {"status": payload.status}


@app.get("/api/filing-periods/{filing_period_id}/gst-f5-summary")
def gst_f5_summary(filing_period_id: int):
    with get_connection() as conn:
        _get_period(conn, filing_period_id)
        return compute_summary(conn, filing_period_id)


@app.post("/api/filing-periods/{filing_period_id}/approve")
def approve_filing(filing_period_id: int):
    with get_connection() as conn:
        _get_period(conn, filing_period_id)
        summary = compute_summary(conn, filing_period_id)
        if not summary["approval_ready"]:
            raise HTTPException(status_code=400, detail="Resolve high-severity anomalies and approve required transaction reviews before final approval")
        conn.execute(
            "UPDATE filing_periods SET status = 'APPROVED', approved_at = ? WHERE id = ?",
            (datetime.now(timezone.utc).isoformat(), filing_period_id),
        )
        write_audit(
            conn,
            filing_period_id,
            Actor.USER,
            "FINAL_APPROVAL_COMPLETED",
            "Human accountant confirmed GST F5 values are ready for manual submission via IRAS myTax Portal. No automatic submission occurred.",
            affected_item="filing_period",
            old_value=summary["status"],
            new_value="APPROVED",
            reason="Final approval confirmation accepted",
            step="Step 6: Human Review and Approval",
        )
        return {"status": "APPROVED"}


@app.get("/api/filing-periods/{filing_period_id}/audit-log")
def audit_log(filing_period_id: int):
    with get_connection() as conn:
        _get_period(conn, filing_period_id)
        rows = conn.execute("SELECT * FROM audit_log WHERE filing_period_id = ? ORDER BY created_at", (filing_period_id,)).fetchall()
        return [dict(row) for row in rows]


@app.get("/api/filing-periods/{filing_period_id}/export/transactions.csv")
def export_transactions(filing_period_id: int):
    with get_connection() as conn:
        _get_period(conn, filing_period_id)
        write_audit(conn, filing_period_id, Actor.SYSTEM, "EXPORT_GENERATED", "Reviewed transactions CSV generated.")
        return transactions_csv(conn, filing_period_id)


@app.get("/api/filing-periods/{filing_period_id}/export/exceptions.csv")
def export_exceptions(filing_period_id: int):
    with get_connection() as conn:
        _get_period(conn, filing_period_id)
        write_audit(conn, filing_period_id, Actor.SYSTEM, "EXPORT_GENERATED", "Reconciliation exceptions CSV generated.")
        return exceptions_csv(conn, filing_period_id)


@app.get("/api/filing-periods/{filing_period_id}/export/audit.csv")
def export_audit(filing_period_id: int):
    with get_connection() as conn:
        _get_period(conn, filing_period_id)
        write_audit(conn, filing_period_id, Actor.SYSTEM, "EXPORT_GENERATED", "Audit trail CSV generated.")
        return audit_csv(conn, filing_period_id)


@app.get("/api/filing-periods/{filing_period_id}/export/gst-f5.json")
def export_gst_f5(filing_period_id: int):
    with get_connection() as conn:
        _get_period(conn, filing_period_id)
        write_audit(conn, filing_period_id, Actor.SYSTEM, "EXPORT_GENERATED", "GST F5 summary JSON generated.")
        return gst_f5_json(conn, filing_period_id)
