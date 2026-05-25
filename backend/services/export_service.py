from __future__ import annotations

import csv
import io
import json
import sqlite3

from fastapi.responses import Response

from services.gst_f5_service import compute_summary


def _csv_response(filename: str, rows: list[sqlite3.Row]) -> Response:
    output = io.StringIO()
    if rows:
        writer = csv.DictWriter(output, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows([dict(row) for row in rows])
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def transactions_csv(conn: sqlite3.Connection, filing_period_id: int) -> Response:
    rows = conn.execute("SELECT * FROM transactions WHERE filing_period_id = ? ORDER BY transaction_date", (filing_period_id,)).fetchall()
    return _csv_response("reviewed_transactions.csv", rows)


def exceptions_csv(conn: sqlite3.Connection, filing_period_id: int) -> Response:
    rows = conn.execute(
        """
        SELECT e.*, t.invoice_no, t.description, t.net_amount, t.gst_treatment
        FROM reconciliation_exceptions e
        JOIN transactions t ON t.id = e.transaction_id
        WHERE t.filing_period_id = ?
        ORDER BY e.severity DESC, e.created_at DESC
        """,
        (filing_period_id,),
    ).fetchall()
    return _csv_response("reconciliation_exceptions.csv", rows)


def audit_csv(conn: sqlite3.Connection, filing_period_id: int) -> Response:
    rows = conn.execute("SELECT * FROM audit_log WHERE filing_period_id = ? ORDER BY created_at", (filing_period_id,)).fetchall()
    return _csv_response("audit_trail.csv", rows)


def gst_f5_json(conn: sqlite3.Connection, filing_period_id: int) -> Response:
    payload = compute_summary(conn, filing_period_id)
    return Response(
        content=json.dumps(payload, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="gst_f5_summary.json"'},
    )
