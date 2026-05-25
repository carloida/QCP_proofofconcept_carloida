import { api } from "../api";

export default function ExportCenter({ periodId }: { periodId: number }) {
  const exports = [
    ["GST F5 summary JSON", "gst-f5.json"],
    ["Reviewed transactions CSV", "transactions.csv"],
    ["Reconciliation exceptions CSV", "exceptions.csv"],
    ["Audit trail CSV", "audit.csv"]
  ] as const;

  return (
    <section className="panel p-5">
      <h2 className="text-lg font-semibold text-ink">Export Center</h2>
      <div className="mt-4 grid gap-2">
        {exports.map(([label, file]) => (
          <a key={file} className="button-secondary text-center" href={api.exportUrl(periodId, file)}>
            {label}
          </a>
        ))}
      </div>
    </section>
  );
}
