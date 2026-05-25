const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

export type FilingPeriod = {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: "DRAFT" | "REVIEW" | "APPROVED" | "EXPORTED";
  created_at: string;
  approved_at?: string | null;
};

export type GstTreatment =
  | "STANDARD_RATED_SUPPLY"
  | "ZERO_RATED_SUPPLY"
  | "EXEMPT_SUPPLY"
  | "OUT_OF_SCOPE_SUPPLY"
  | "TAXABLE_PURCHASE"
  | "DISALLOWED_INPUT_TAX"
  | "REVERSE_CHARGE"
  | "REVIEW_REQUIRED";

export type UITransactionTreatment =
  | "standard_rated"
  | "zero_rated"
  | "exempt"
  | "out_of_scope"
  | "non_claimable_input_tax"
  | "needs_review";

export type StepStatus = "Not Started" | "In Progress" | "AI Completed" | "Needs Human Review" | "Approved" | "Blocked";
export type ActorType = "AI" | "Human" | "Manager" | "System";
export type IngestionSourceType = "CSV_EXCEL" | "SAMPLE_DATASET" | "DATABASE" | "ACCOUNTING_API" | "SUPPORTING_EVIDENCE";
export type IngestionStatus = "Not Connected" | "Ready" | "Processing" | "Imported" | "Needs Review" | "Failed";
export type EvidenceStatus = "Valid" | "Missing" | "Needs Review" | "Unlinked" | "Rejected";

export type IngestionSource = {
  id: string;
  name: string;
  type: IngestionSourceType;
  status: IngestionStatus;
  recordCount: number;
  lastUpdated: string;
  owner: "Human" | "AI" | "System";
};

export type SourceRecordPreview = {
  invoice_number: string;
  counterparty: string;
  transaction_type: string;
  net_amount_sgd: number;
  gst_amount_sgd: number;
  validation_status: string;
};

export type ColumnMapping = {
  detectedColumn: string;
  canonicalField: string;
};

export type EvidenceDocument = {
  document_id: string;
  file_name: string;
  document_type: "tax invoice" | "export evidence" | "import permit" | "receipt" | "credit note";
  linked_transaction_id: string;
  evidence_status: EvidenceStatus;
  uploaded_at: string;
  review_status: "Pending Review" | "Approved" | "Rejected";
};

export type CanonicalGSTTransaction = {
  transaction_id: string;
  source_system: string;
  source_record_id: string;
  ingestion_batch_id: string;
  document_id: string;
  transaction_date: string;
  posting_date: string;
  invoice_number: string;
  supplier_name: string;
  customer_name: string;
  supplier_gst_registered: boolean;
  customer_country: string;
  description: string;
  transaction_type: string;
  currency: string;
  exchange_rate_to_sgd: number;
  net_amount_sgd: number;
  gst_amount_sgd: number;
  gross_amount_sgd: number;
  tax_code_from_source: string;
  ai_gst_treatment: string;
  confidence_score: number;
  evidence_status: EvidenceStatus;
  approval_status: string;
};

export type IngestionBatch = {
  batch_id: string;
  source_id: string;
  raw_records: number;
  standardized_records: number;
  validation_status: string;
};

export type WorkflowStep = {
  id: number;
  title: string;
  status: StepStatus;
  owner: "AI Agent" | "Human Accountant" | "Manager" | "System";
  summary: string;
};

export type Transaction = {
  id: number;
  filing_period_id: number;
  transaction_date: string;
  invoice_no?: string | null;
  source_system?: string | null;
  transaction_type: "SALE" | "PURCHASE" | "ADJUSTMENT";
  counterparty_name?: string | null;
  counterparty_country?: string | null;
  gl_account?: string | null;
  description?: string | null;
  currency: string;
  net_amount: number;
  gst_amount: number;
  gross_amount: number;
  original_tax_code?: string | null;
  gst_treatment: GstTreatment;
  classification_confidence: number;
  classification_reason: string;
  review_status: "AUTO_CLASSIFIED" | "NEEDS_REVIEW" | "OVERRIDDEN" | "APPROVED";
  anomaly_score?: number | null;
  max_exception_severity?: "LOW" | "MEDIUM" | "HIGH" | null;
};

export type ExceptionItem = {
  id: number;
  transaction_id: number;
  severity: "LOW" | "MEDIUM" | "HIGH";
  exception_type: string;
  message: string;
  resolved: boolean;
  status?: "Open" | "Resolved" | "Accepted Risk" | "Needs Follow Up" | "Excluded From Filing";
  resolution_comment?: string | null;
  invoice_no?: string | null;
  counterparty_name?: string | null;
  description?: string | null;
  net_amount?: number;
  created_at: string;
};

export type AuditLogItem = {
  id: number;
  filing_period_id: number;
  transaction_id?: number | null;
  actor: "SYSTEM" | "USER";
  actor_type?: ActorType | "Human" | "System";
  action: string;
  details: string;
  affected_item?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  reason?: string | null;
  step?: string | null;
  created_at: string;
};

export type GstF5Summary = {
  filing_period_id: number;
  status: FilingPeriod["status"];
  transaction_count: number;
  exception_count: number;
  high_exception_count: number;
  needs_review_count: number;
  box_1_standard_rated_supplies: number;
  box_2_zero_rated_supplies: number;
  box_3_exempt_supplies: number;
  box_4_total_supplies: number;
  box_5_taxable_purchases: number;
  box_6_output_tax_due: number;
  box_7_input_tax_claimed: number;
  box_8_net_gst_payable: number;
  box_13_revenue: number;
  box_counts: Record<string, number>;
  approval_ready: boolean;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 2500);
  const response = await fetch(`${API_BASE}${path}`, { ...init, signal: init?.signal ?? controller.signal }).finally(() => {
    window.clearTimeout(timeout);
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  createPeriod: (payload: { name: string; start_date: string; end_date: string }) =>
    request<FilingPeriod>("/api/filing-periods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
  listPeriods: () => request<FilingPeriod[]>("/api/filing-periods"),
  upload: (periodId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ inserted: number; exceptions: number; review_required: number }>(
      `/api/filing-periods/${periodId}/upload`,
      { method: "POST", body: form }
    );
  },
  loadSample: (periodId: number) =>
    request<{ inserted: number; exceptions: number; review_required: number }>(`/api/filing-periods/${periodId}/load-sample`, {
      method: "POST"
    }),
  transactions: (periodId: number) => request<Transaction[]>(`/api/filing-periods/${periodId}/transactions`),
  exceptions: (periodId: number) => request<ExceptionItem[]>(`/api/filing-periods/${periodId}/exceptions`),
  summary: (periodId: number) => request<GstF5Summary>(`/api/filing-periods/${periodId}/gst-f5-summary`),
  audit: (periodId: number) => request<AuditLogItem[]>(`/api/filing-periods/${periodId}/audit-log`),
  approve: (periodId: number) => request<{ status: string }>(`/api/filing-periods/${periodId}/approve`, { method: "POST" }),
  approveTransaction: (transactionId: number, payload: { user_name: string; comment: string }) =>
    request<{ status: string }>(`/api/transactions/${transactionId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
  updateExceptionStatus: (exceptionId: number, payload: { status: NonNullable<ExceptionItem["status"]>; comment?: string }) =>
    request<{ status: string }>(`/api/exceptions/${exceptionId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
  override: (transactionId: number, payload: { new_treatment: GstTreatment; reason: string; user_name: string }) =>
    request(`/api/transactions/${transactionId}/override`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
  exportUrl: (periodId: number, file: "transactions.csv" | "exceptions.csv" | "audit.csv" | "gst-f5.json") =>
    `${API_BASE}/api/filing-periods/${periodId}/export/${file}`
};

export const gstTreatments: GstTreatment[] = [
  "STANDARD_RATED_SUPPLY",
  "ZERO_RATED_SUPPLY",
  "EXEMPT_SUPPLY",
  "OUT_OF_SCOPE_SUPPLY",
  "TAXABLE_PURCHASE",
  "DISALLOWED_INPUT_TAX",
  "REVERSE_CHARGE",
  "REVIEW_REQUIRED"
];

export function toUiTreatment(treatment: GstTreatment): UITransactionTreatment {
  switch (treatment) {
    case "STANDARD_RATED_SUPPLY":
      return "standard_rated";
    case "ZERO_RATED_SUPPLY":
      return "zero_rated";
    case "EXEMPT_SUPPLY":
      return "exempt";
    case "OUT_OF_SCOPE_SUPPLY":
      return "out_of_scope";
    case "DISALLOWED_INPUT_TAX":
      return "non_claimable_input_tax";
    default:
      return "needs_review";
  }
}
