const columns = [
  {
    title: "AI handles",
    badge: "AI Task",
    items: [
      "Parse uploaded or sample financial data",
      "Standardize transaction fields",
      "Propose GST treatment classification",
      "Compute confidence score",
      "Detect anomalies",
      "Compute GST F5 boxes",
      "Generate filing pack draft",
      "Prepare export files"
    ]
  },
  {
    title: "Human accountant handles",
    badge: "Human Review",
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
    items: ["Final sign-off before manual filing"]
  },
  {
    title: "System handles",
    badge: "System Audit",
    items: ["Audit logging", "Version tracking", "Export records"]
  }
];

export default function ResponsibilityMatrix() {
  return (
    <section className="panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Responsibility Matrix</h2>
          <p className="mt-1 text-sm text-slate-600">Clear separation between agent automation, human judgement, manager approval, and system records.</p>
        </div>
        <span className="badge-blocked">Human Approval Required</span>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        {columns.map((column) => (
          <article key={column.title} className="rounded-md border border-line bg-surface p-4">
            <span className={column.badge.includes("Human") ? "badge-human" : column.badge.includes("AI") ? "badge-ai" : "badge-audit"}>{column.badge}</span>
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
