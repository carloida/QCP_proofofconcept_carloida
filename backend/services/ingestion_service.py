from __future__ import annotations

import sqlite3
from datetime import date

import pandas as pd

from models import Actor
from services.audit_service import write_audit
from services.classification_service import classify_transaction
from services.reconciliation_service import generate_exceptions

REQUIRED_COLUMNS = [
    "transaction_date",
    "invoice_no",
    "source_system",
    "transaction_type",
    "counterparty_name",
    "counterparty_country",
    "gl_account",
    "description",
    "currency",
    "net_amount",
    "gst_amount",
    "gross_amount",
    "original_tax_code",
]


def ingest_csv(
    conn: sqlite3.Connection,
    filing_period_id: int,
    csv_file,
    start_date: date,
    end_date: date,
) -> dict:
    df = pd.read_csv(csv_file)
    missing = [column for column in REQUIRED_COLUMNS if column not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")

    df = df[REQUIRED_COLUMNS].copy()
    df["transaction_date"] = pd.to_datetime(df["transaction_date"], errors="coerce").dt.date
    for column in ["net_amount", "gst_amount", "gross_amount"]:
        df[column] = pd.to_numeric(df[column], errors="coerce").fillna(0).round(2)
    for column in ["invoice_no", "source_system", "counterparty_name", "counterparty_country", "gl_account", "description", "currency", "original_tax_code"]:
        df[column] = df[column].fillna("").astype(str).str.strip()
    df["transaction_type"] = df["transaction_type"].fillna("ADJUSTMENT").astype(str).str.upper().str.strip()
    df = df.dropna(subset=["transaction_date"])

    conn.execute("DELETE FROM transactions WHERE filing_period_id = ?", (filing_period_id,))
    inserted = 0
    review_required = 0
    for record in df.to_dict(orient="records"):
        result = classify_transaction(record)
        if result.review_status.value == "NEEDS_REVIEW":
            review_required += 1
        conn.execute(
            """
            INSERT INTO transactions (
                filing_period_id, transaction_date, invoice_no, source_system, transaction_type,
                counterparty_name, counterparty_country, gl_account, description, currency,
                net_amount, gst_amount, gross_amount, original_tax_code, gst_treatment,
                classification_confidence, classification_reason, review_status, anomaly_score
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                filing_period_id,
                record["transaction_date"].isoformat(),
                record["invoice_no"] or None,
                record["source_system"] or None,
                record["transaction_type"],
                record["counterparty_name"] or None,
                record["counterparty_country"] or None,
                record["gl_account"] or None,
                record["description"] or None,
                record["currency"] or "SGD",
                float(record["net_amount"]),
                float(record["gst_amount"]),
                float(record["gross_amount"]),
                record["original_tax_code"] or None,
                result.treatment.value,
                result.confidence,
                result.reason,
                result.review_status.value,
                round(1 - result.confidence, 2),
            ),
        )
        inserted += 1

    exceptions = generate_exceptions(conn, filing_period_id, start_date, end_date)
    conn.execute("UPDATE filing_periods SET status = 'REVIEW' WHERE id = ?", (filing_period_id,))
    write_audit(conn, filing_period_id, Actor.SYSTEM, "FILE_UPLOADED", f"CSV uploaded with {len(df)} valid rows.")
    write_audit(conn, filing_period_id, Actor.SYSTEM, "TRANSACTIONS_INGESTED", f"{inserted} transactions cleaned and stored.")
    write_audit(conn, filing_period_id, Actor.SYSTEM, "CLASSIFICATIONS_GENERATED", f"{inserted - review_required} auto-classified; {review_required} require review.")
    write_audit(conn, filing_period_id, Actor.SYSTEM, "EXCEPTIONS_GENERATED", f"{exceptions} reconciliation exceptions generated.")
    write_audit(conn, filing_period_id, Actor.SYSTEM, "GST_F5_RECALCULATED", "Box 1 to Box 8 summary recalculated after upload.")
    return {"inserted": inserted, "exceptions": exceptions, "review_required": review_required}
