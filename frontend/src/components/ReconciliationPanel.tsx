import { ExceptionItem } from "../api";

const severityTone = {
  HIGH: "border-[#D92243]/30 bg-[#D92243]/10 text-risk",
  MEDIUM: "border-[#F69D39]/35 bg-[#FFF5E5] text-[#9A4F10]",
  LOW: "border-slate-200 bg-slate-50 text-slate-700"
};

export default function ReconciliationPanel({ exceptions }: { exceptions: ExceptionItem[] }) {
  return (
    <section className="panel p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Reconciliation Exceptions</h2>
          <p className="mt-1 text-sm text-slate-600">Rule-based checks for rate mismatches, duplicates, missing fields, period boundaries, FX, and high-value movements.</p>
        </div>
        <span className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-ink">{exceptions.length}</span>
      </div>
      <div className="mt-4 grid max-h-80 gap-3 overflow-auto pr-1">
        {exceptions.map((item) => (
          <article key={item.id} className="rounded-md border border-line p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${severityTone[item.severity]}`}>{item.severity}</span>
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{item.exception_type}</span>
              <span className="text-xs text-slate-500">Transaction #{item.transaction_id}</span>
            </div>
            <p className="mt-2 text-sm font-medium text-ink">{item.message}</p>
            <p className="mt-1 text-xs text-slate-500">
              {item.invoice_no || "Missing invoice"} - {item.counterparty_name || "Missing counterparty"} - {item.description}
            </p>
          </article>
        ))}
        {!exceptions.length && <p className="text-sm text-slate-500">No exceptions generated yet.</p>}
      </div>
    </section>
  );
}
