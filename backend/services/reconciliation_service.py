from __future__ import annotations

import sqlite3
from datetime import date

from models import GstTreatment, Severity


def _add_exception(
    conn: sqlite3.Connection,
    transaction_id: int,
    severity: Severity,
    exception_type: str,
    message: str,
) -> None:
    conn.execute(
        """
        INSERT INTO reconciliation_exceptions
        (transaction_id, severity, exception_type, message, status)
        VALUES (?, ?, ?, ?, 'Open')
        """,
        (transaction_id, severity.value, exception_type, message),
    )


def generate_exceptions(conn: sqlite3.Connection, filing_period_id: int, start_date: date, end_date: date) -> int:
    conn.execute(
        """
        DELETE FROM reconciliation_exceptions
        WHERE transaction_id IN (SELECT id FROM transactions WHERE filing_period_id = ?)
          AND (status = 'Open' OR status IS NULL)
        """,
        (filing_period_id,),
    )
    rows = conn.execute("SELECT * FROM transactions WHERE filing_period_id = ?", (filing_period_id,)).fetchall()
    if not rows:
        return 0

    abs_values = sorted(abs(float(row["net_amount"])) for row in rows)
    percentile_index = max(0, int(len(abs_values) * 0.95) - 1)
    high_value_threshold = max(50000.0, abs_values[percentile_index])

    invoice_counts: dict[str, int] = {}
    for row in rows:
        invoice = (row["invoice_no"] or "").strip().upper()
        if invoice:
            invoice_counts[invoice] = invoice_counts.get(invoice, 0) + 1

    count = 0
    for row in rows:
        transaction_id = row["id"]
        invoice = (row["invoice_no"] or "").strip()
        counterparty = (row["counterparty_name"] or "").strip()
        currency = (row["currency"] or "").strip().upper()
        treatment = row["gst_treatment"]
        net_amount = float(row["net_amount"])
        gst_amount = float(row["gst_amount"])
        tx_date = date.fromisoformat(row["transaction_date"])

        def flag(severity: Severity, exception_type: str, message: str) -> None:
            nonlocal count
            _add_exception(conn, transaction_id, severity, exception_type, message)
            count += 1

        if treatment in (GstTreatment.STANDARD_RATED_SUPPLY.value, GstTreatment.REVERSE_CHARGE.value):
            expected = round(net_amount * 0.09, 2)
            if abs(expected - gst_amount) > 1.00:
                flag(
                    Severity.HIGH,
                    "GST_RATE_MISMATCH",
                    f"Expected GST at 9 percent is {expected:.2f}, but transaction has {gst_amount:.2f}.",
                )

        if treatment == GstTreatment.ZERO_RATED_SUPPLY.value and "evidence" not in (row["description"] or "").lower():
            flag(Severity.MEDIUM, "ZERO_RATED_EVIDENCE_MISSING", "Zero-rated sale is missing export or international-services evidence.")

        if not invoice:
            flag(Severity.MEDIUM, "MISSING_TAX_INVOICE", "Input tax claim requires a valid tax invoice or import permit.")
        elif invoice_counts.get(invoice.upper(), 0) > 1:
            flag(Severity.MEDIUM, "DUPLICATE_INVOICE", f"Invoice number {invoice} appears more than once.")

        if not counterparty:
            flag(Severity.MEDIUM, "MISSING_COUNTERPARTY", "Supplier or customer name is missing.")

        if currency != "SGD":
            flag(Severity.HIGH, "FOREIGN_CURRENCY", "Foreign currency transaction requires SGD conversion support.")

        if tx_date < start_date or tx_date > end_date:
            flag(Severity.HIGH, "OUT_OF_PERIOD", "Transaction date falls outside the filing period.")

        if net_amount < 0 or gst_amount < 0:
            flag(Severity.MEDIUM, "NEGATIVE_VALUE", "Negative value or credit note requires accountant review.")

        if abs(net_amount) >= high_value_threshold:
            flag(Severity.LOW, "HIGH_VALUE", f"Transaction exceeds high-value threshold of {high_value_threshold:.2f}.")

        if treatment == GstTreatment.DISALLOWED_INPUT_TAX.value and abs(gst_amount) > 0:
            flag(Severity.LOW, "NON_CLAIMABLE_INPUT_TAX", "Motor car or restricted expense is marked non-claimable and retained for review.")

        if "employee reimbursement" in (row["description"] or "").lower():
            flag(Severity.MEDIUM, "EMPLOYEE_REIMBURSEMENT_REVIEW", "Employee reimbursement needs business-purpose and tax-invoice review.")

        if "supplier not gst registered" in (row["description"] or "").lower():
            flag(Severity.HIGH, "SUPPLIER_NOT_GST_REGISTERED", "Purchase has GST but supplier appears not GST registered.")

    return count
