const columns = [
  {
    title: "Real AI enabled",
    badge: "Real AI Enabled",
    badgeClass: "badge-ai",
    surfaceClass: "surface-ai",
    items: [
      "Ingestion & Data Quality Agent reviews parsed records",
      "GST Treatment Classification Agent recommends GST treatment",
      "Confidence, reason, review flag, and token usage are recorded"
    ]
  },
  {
    title: "Deterministic controls",
    badge: "Deterministic Control",
    badgeClass: "badge-system",
    surfaceClass: "surface-audit",
    items: [
      "Evidence matching rules remain controlled",
      "Reconciliation and anomaly checks are deterministic",
      "GST F5 computation uses deterministic formulas",
      "Workflow routing and export remain deterministic"
    ]
  },
  {
    title: "Human accountant handles",
    badge: "Human Review",
    badgeClass: "badge-human",
    surfaceClass: "surface-human",
    items: [
      "Confirm reporting quarter",
      "Confirm GST registration status",
      "Review validation errors",
      "Approve or override GST classification",
      "Resolve anomalies",
      "Review GST F5 computation",
      "Approve filing pack before submission"
    ]
  },
  {
    title: "Manager handles",
    badge: "Human Approval Required",
    badgeClass: "badge-blocked",
    surfaceClass: "surface-approval",
    items: ["Final sign-off before manual filing"]
  },
  {
    title: "Placeholder modules",
    badge: "Placeholder",
    badgeClass: "badge-audit",
    surfaceClass: "surface-human",
    items: ["Enterprise evidence OCR", "Accounting API connectors", "Future filing-pack enrichments"]
  }
];

export default function ResponsibilityMatrix() {
  return (
    <section className="panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Responsibility Matrix</h2>
          <p className="mt-1 text-sm text-slate-600">
            This prototype currently uses real AI for ingestion quality review and GST treatment classification. Other workflow modules are deterministic controls or placeholders to preserve compliance predictability.
          </p>
        </div>
        <span className="badge-blocked">Human Approval Required</span>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        {columns.map((column) => (
          <article key={column.title} className={`rounded-md p-4 ${column.surfaceClass}`}>
            <span className={column.badgeClass}>{column.badge}</span>
            <h3 className="mt-3 text-sm font-semibold text-ink">{column.title}</h3>
            <ul className="mt-3 space-y-2 text-sm leading-5 text-slate-600">
              {column.items.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
