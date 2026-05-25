const canonicalFields = [
  "transaction_id",
  "source_system",
  "source_record_id",
  "ingestion_batch_id",
  "document_id",
  "transaction_date",
  "posting_date",
  "invoice_number",
  "supplier_name",
  "customer_name",
  "supplier_gst_registered",
  "customer_country",
  "description",
  "transaction_type",
  "currency",
  "exchange_rate_to_sgd",
  "net_amount_sgd",
  "gst_amount_sgd",
  "gross_amount_sgd",
  "tax_code_from_source",
  "ai_gst_treatment",
  "confidence_score",
  "evidence_status",
  "approval_status"
];

const responsibilities = [
  {
    label: "AI Task",
    title: "AI prepares",
    badgeClass: "badge-ai",
    surfaceClass: "surface-ai",
    items: ["Standardize records", "Recommend GST treatment", "Detect anomalies", "Compute F5 draft"]
  },
  {
    label: "Human Review",
    title: "Accountant controls",
    badgeClass: "badge-human",
    surfaceClass: "surface-human",
    items: ["Confirm setup", "Review exceptions", "Override treatment", "Approve F5 values"]
  },
  {
    label: "Human Approval Required",
    title: "Manager approves",
    badgeClass: "badge-blocked",
    surfaceClass: "surface-approval",
    items: ["Review filing pack", "Final sign-off", "Return for revision"]
  },
  {
    label: "System Audit",
    title: "System records",
    badgeClass: "badge-audit",
    surfaceClass: "surface-audit",
    items: ["Log actions", "Track versions", "Prepare export records"]
  }
];

type ReferenceView = "Schema" | "Owners";

export default function WorkflowReferencePanel({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <section className="panel flex h-full flex-col overflow-hidden">
      <button
        className="flex w-full shrink-0 items-start justify-between gap-3 p-4 text-left transition hover:bg-[#FFFBF5]"
        onClick={onToggle}
        aria-expanded={open}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9A4F10]">Workflow reference</p>
          <h2 className="mt-1 text-base font-semibold text-ink">Schema and ownership</h2>
        </div>
        <span className="button-secondary shrink-0 px-3 py-1">{open ? "Collapse" : "Expand"}</span>
      </button>

      <div className="grid shrink-0 gap-2 border-t border-line px-4 py-3 sm:grid-cols-2">
        <div className="rounded-md border border-line bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Canonical schema</p>
          <p className="mt-1 text-sm font-semibold text-ink">{canonicalFields.length} fields</p>
        </div>
        <div className="rounded-md border border-line bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Control model</p>
          <p className="mt-1 text-sm font-semibold text-ink">Human approved</p>
        </div>
      </div>
      <p className="border-t border-line px-4 py-3 text-xs leading-5 text-slate-500">
        {open ? "Reference drawer is open below." : "Expand to view schema fields and owner responsibilities."}
      </p>
    </section>
  );
}

export function WorkflowReferenceDetails({ view, onViewChange }: { view: ReferenceView; onViewChange: (view: ReferenceView) => void }) {
  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line bg-[#FFFBF5] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9A4F10]">Expanded workflow reference</p>
          <h2 className="mt-1 text-lg font-semibold text-ink">GST data schema and responsibility controls</h2>
        </div>
        <div className="flex gap-2">
          {(["Schema", "Owners"] as ReferenceView[]).map((item) => (
            <button
              key={item}
              className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                view === item ? "border-[#F69D39] bg-[#F69D39] text-ink" : "border-line bg-white text-muted hover:bg-warm"
              }`}
              onClick={() => onViewChange(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {view === "Schema" ? (
          <div>
            <p className="text-sm leading-6 text-slate-600">
              Every source record is converted into this canonical GST schema before AI classification and human review.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {canonicalFields.map((field) => (
                <span key={field} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                  {field}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-4">
            {responsibilities.map((item) => (
              <article key={item.label} className={`rounded-md p-4 ${item.surfaceClass}`}>
                <span className={item.badgeClass}>{item.label}</span>
                <h3 className="mt-3 text-sm font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.items.join(" / ")}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
