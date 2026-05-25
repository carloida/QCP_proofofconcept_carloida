from __future__ import annotations

from datetime import date, datetime
from pydantic import BaseModel, Field

from models import FilingStatus, GstTreatment, ReviewStatus, Severity, TransactionType


class FilingPeriodCreate(BaseModel):
    name: str = Field(min_length=3)
    start_date: date
    end_date: date


class FilingPeriod(BaseModel):
    id: int
    name: str
    start_date: date
    end_date: date
    status: FilingStatus
    created_at: datetime
    approved_at: datetime | None = None


class Transaction(BaseModel):
    id: int
    filing_period_id: int
    transaction_date: date
    invoice_no: str | None = None
    source_system: str | None = None
    transaction_type: TransactionType
    counterparty_name: str | None = None
    counterparty_country: str | None = None
    gl_account: str | None = None
    description: str | None = None
    currency: str
    net_amount: float
    gst_amount: float
    gross_amount: float
    original_tax_code: str | None = None
    gst_treatment: GstTreatment
    classification_confidence: float
    classification_reason: str
    review_status: ReviewStatus
    anomaly_score: float | None = 0
    created_at: datetime
    updated_at: datetime


class TransactionWithSeverity(Transaction):
    max_exception_severity: Severity | None = None


class ReconciliationException(BaseModel):
    id: int
    transaction_id: int
    severity: Severity
    exception_type: str
    message: str
    resolved: bool
    created_at: datetime


class OverrideRequest(BaseModel):
    new_treatment: GstTreatment
    reason: str = Field(min_length=8)
    user_name: str = Field(default="Carlo Emilio Ida", min_length=2)


class ApprovalRequest(BaseModel):
    user_name: str = Field(default="Carlo Emilio Ida", min_length=2)
    comment: str = Field(default="Human accountant reviewed classification and supporting evidence.", min_length=8)


class ExceptionStatusRequest(BaseModel):
    status: str = Field(pattern="^(Open|Resolved|Accepted Risk|Needs Follow Up|Excluded From Filing)$")
    comment: str | None = None


class AuditLog(BaseModel):
    id: int
    filing_period_id: int
    transaction_id: int | None = None
    actor: str
    action: str
    details: str
    created_at: datetime


class GstF5Summary(BaseModel):
    filing_period_id: int
    status: FilingStatus
    transaction_count: int
    exception_count: int
    high_exception_count: int
    needs_review_count: int
    box_1_standard_rated_supplies: float
    box_2_zero_rated_supplies: float
    box_3_exempt_supplies: float
    box_4_total_supplies: float
    box_5_taxable_purchases: float
    box_6_output_tax_due: float
    box_7_input_tax_claimed: float
    box_8_net_gst_payable: float
    box_13_revenue: float = 0
    box_counts: dict[str, int] = {}
    approval_ready: bool
