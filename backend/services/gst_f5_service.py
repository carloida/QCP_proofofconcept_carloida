from __future__ import annotations

import sqlite3

from models import FilingStatus, GstTreatment


def _round(value: float) -> float:
    return round(value or 0, 2)


def compute_summary(conn: sqlite3.Connection, filing_period_id: int) -> dict:
    period = conn.execute("SELECT * FROM filing_periods WHERE id = ?", (filing_period_id,)).fetchone()
    rows = conn.execute("SELECT * FROM transactions WHERE filing_period_id = ?", (filing_period_id,)).fetchall()
    exceptions = conn.execute(
        """
        SELECT severity, COUNT(*) AS count
        FROM reconciliation_exceptions e
        JOIN transactions t ON t.id = e.transaction_id
        WHERE t.filing_period_id = ? AND e.resolved = 0
        GROUP BY severity
        """,
        (filing_period_id,),
    ).fetchall()

    exception_count = sum(row["count"] for row in exceptions)
    high_exception_count = sum(row["count"] for row in exceptions if row["severity"] == "HIGH")
    needs_review_count = sum(1 for row in rows if row["review_status"] in ("NEEDS_REVIEW", "OVERRIDDEN"))

    def sum_net(*treatments: GstTreatment) -> float:
        values = {t.value for t in treatments}
        return _round(sum(row["net_amount"] for row in rows if row["gst_treatment"] in values))

    def sum_gst(*treatments: GstTreatment) -> float:
        values = {t.value for t in treatments}
        return _round(sum(row["gst_amount"] for row in rows if row["gst_treatment"] in values))

    def count_tx(*treatments: GstTreatment) -> int:
        values = {t.value for t in treatments}
        return sum(1 for row in rows if row["gst_treatment"] in values)

    box_1 = sum_net(GstTreatment.STANDARD_RATED_SUPPLY, GstTreatment.REVERSE_CHARGE)
    box_2 = sum_net(GstTreatment.ZERO_RATED_SUPPLY)
    box_3 = sum_net(GstTreatment.EXEMPT_SUPPLY)
    box_4 = _round(box_1 + box_2 + box_3)
    box_5 = sum_net(GstTreatment.TAXABLE_PURCHASE, GstTreatment.REVERSE_CHARGE)
    box_6 = sum_gst(GstTreatment.STANDARD_RATED_SUPPLY, GstTreatment.REVERSE_CHARGE)
    box_7 = sum_gst(GstTreatment.TAXABLE_PURCHASE)
    box_8 = _round(box_6 - box_7)
    box_13 = _round(box_4)

    return {
        "filing_period_id": filing_period_id,
        "status": period["status"] if period else FilingStatus.DRAFT.value,
        "transaction_count": len(rows),
        "exception_count": exception_count,
        "high_exception_count": high_exception_count,
        "needs_review_count": needs_review_count,
        "box_1_standard_rated_supplies": box_1,
        "box_2_zero_rated_supplies": box_2,
        "box_3_exempt_supplies": box_3,
        "box_4_total_supplies": box_4,
        "box_5_taxable_purchases": box_5,
        "box_6_output_tax_due": box_6,
        "box_7_input_tax_claimed": box_7,
        "box_8_net_gst_payable": box_8,
        "box_13_revenue": box_13,
        "box_counts": {
            "box_1": count_tx(GstTreatment.STANDARD_RATED_SUPPLY, GstTreatment.REVERSE_CHARGE),
            "box_2": count_tx(GstTreatment.ZERO_RATED_SUPPLY),
            "box_3": count_tx(GstTreatment.EXEMPT_SUPPLY),
            "box_4": count_tx(GstTreatment.STANDARD_RATED_SUPPLY, GstTreatment.ZERO_RATED_SUPPLY, GstTreatment.EXEMPT_SUPPLY, GstTreatment.REVERSE_CHARGE),
            "box_5": count_tx(GstTreatment.TAXABLE_PURCHASE, GstTreatment.REVERSE_CHARGE),
            "box_6": count_tx(GstTreatment.STANDARD_RATED_SUPPLY, GstTreatment.REVERSE_CHARGE),
            "box_7": count_tx(GstTreatment.TAXABLE_PURCHASE),
            "box_8": len(rows),
            "box_13": count_tx(GstTreatment.STANDARD_RATED_SUPPLY, GstTreatment.ZERO_RATED_SUPPLY, GstTreatment.EXEMPT_SUPPLY, GstTreatment.REVERSE_CHARGE),
        },
        "approval_ready": high_exception_count == 0 and needs_review_count == 0 and len(rows) > 0,
    }
