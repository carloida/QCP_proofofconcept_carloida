from __future__ import annotations

from dataclasses import dataclass

from models import GstTreatment, ReviewStatus


DISALLOWED_KEYWORDS = [
    "motor car",
    "club subscription",
    "private expense",
    "gambling",
    "staff medical insurance",
]
EXEMPT_KEYWORDS = [
    "interest income",
    "bank interest",
    "residential property",
    "financial service",
    "investment precious metal",
    "digital payment token",
]
OUT_OF_SCOPE_KEYWORDS = ["dividend", "salary", "payroll", "traffic fine", "transfer within group", "overseas-to-overseas"]
REVERSE_CHARGE_KEYWORDS = ["overseas service", "imported service", "low value goods", "reverse charge"]


@dataclass(frozen=True)
class ClassificationResult:
    treatment: GstTreatment
    confidence: float
    reason: str
    review_status: ReviewStatus


def classify_transaction(row: dict) -> ClassificationResult:
    transaction_type = str(row.get("transaction_type", "")).upper()
    country = str(row.get("counterparty_country", "")).upper()
    tax_code = str(row.get("original_tax_code", "")).lower()
    gl_account = str(row.get("gl_account", "")).lower()
    description = str(row.get("description", "")).lower()
    searchable = f"{gl_account} {description}"

    if any(keyword in searchable for keyword in DISALLOWED_KEYWORDS):
        return ClassificationResult(
            GstTreatment.DISALLOWED_INPUT_TAX,
            0.88,
            "Disallowed input tax keyword matched in GL account or description.",
            ReviewStatus.NEEDS_REVIEW,
        )

    if any(keyword in searchable for keyword in REVERSE_CHARGE_KEYWORDS):
        return ClassificationResult(
            GstTreatment.REVERSE_CHARGE,
            0.82,
            "Imported service or reverse charge indicator detected.",
            ReviewStatus.NEEDS_REVIEW,
        )

    if any(keyword in searchable for keyword in EXEMPT_KEYWORDS):
        return ClassificationResult(
            GstTreatment.EXEMPT_SUPPLY,
            0.92,
            "Exempt supply keyword matched.",
            ReviewStatus.AUTO_CLASSIFIED,
        )

    if any(keyword in searchable for keyword in OUT_OF_SCOPE_KEYWORDS):
        return ClassificationResult(
            GstTreatment.OUT_OF_SCOPE_SUPPLY,
            0.90,
            "Out-of-scope keyword matched.",
            ReviewStatus.AUTO_CLASSIFIED,
        )

    if transaction_type == "SALE" and country == "SG" and (
        "sr" in tax_code or "gst" in tax_code or "local service" in description
    ):
        return ClassificationResult(
            GstTreatment.STANDARD_RATED_SUPPLY,
            0.95,
            "Singapore sale with standard-rated GST tax code or local service cue.",
            ReviewStatus.AUTO_CLASSIFIED,
        )

    if transaction_type == "SALE" and (country and country != "SG" or "export" in description or "international service" in description):
        return ClassificationResult(
            GstTreatment.ZERO_RATED_SUPPLY,
            0.90,
            "Export or non-Singapore customer sale treated as zero-rated.",
            ReviewStatus.AUTO_CLASSIFIED,
        )

    if transaction_type == "PURCHASE" and ("gst" in tax_code or "tx" in tax_code):
        return ClassificationResult(
            GstTreatment.TAXABLE_PURCHASE,
            0.90,
            "Purchase with claimable GST tax code and no disallowed keyword.",
            ReviewStatus.AUTO_CLASSIFIED,
        )

    return ClassificationResult(
        GstTreatment.REVIEW_REQUIRED,
        0.45,
        "Insufficient deterministic rule evidence; accountant review required.",
        ReviewStatus.NEEDS_REVIEW,
    )
