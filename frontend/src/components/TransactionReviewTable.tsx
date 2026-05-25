import { FormEvent, useMemo, useState } from "react";
import { api, ExceptionItem, gstTreatments, GstTreatment, Transaction } from "../api";

const money = new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" });

function badge(value?: string | null) {
  const tone =
    value === "HIGH"
      ? "bg-[#D92243]/10 text-risk border-[#D92243]/30"
      : value === "MEDIUM"
        ? "bg-[#FFF5E5] text-[#9A4F10] border-[#F69D39]/35"
        : value === "LOW"
          ? "bg-slate-100 text-slate-700 border-slate-200"
          : "bg-[#FFF9EE] text-[#6F5D24] border-[#E0C375]/60";
  return `inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${tone}`;
}

export default function TransactionReviewTable({
  transactions,
  exceptions,
  onRefresh
}: {
  transactions: Transaction[];
  exceptions: ExceptionItem[];
  onRefresh: () => void;
}) {
  const [treatmentFilter, setTreatmentFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [newTreatment, setNewTreatment] = useState<GstTreatment>("REVIEW_REQUIRED");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const exceptionCounts = useMemo(() => {
    return exceptions.reduce<Record<number, number>>((acc, item) => {
      acc[item.transaction_id] = (acc[item.transaction_id] ?? 0) + 1;
      return acc;
    }, {});
  }, [exceptions]);

  const rows = transactions.filter((transaction) => {
    const confidenceGroup =
      transaction.classification_confidence >= 0.85 ? "HIGH" : transaction.classification_confidence >= 0.65 ? "MEDIUM" : "LOW";
    return (
      (treatmentFilter === "ALL" || transaction.gst_treatment === treatmentFilter) &&
      (statusFilter === "ALL" || transaction.review_status === statusFilter || confidenceGroup === statusFilter) &&
      (severityFilter === "ALL" || transaction.max_exception_severity === severityFilter)
    );
  });

  async function submitOverride(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    try {
      setError("");
      await api.override(selected.id, { new_treatment: newTreatment, reason, user_name: "Carlo Emilio Ida" });
      setSelected(null);
      setReason("");
      onRefresh();
    } catch (overrideError) {
      setError(overrideError instanceof Error ? overrideError.message : "Override failed.");
    }
  }

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line p-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Transaction Review</h2>
          <p className="mt-1 text-sm text-slate-600">Review explainable classification, exception severity, and accountant overrides.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <select className="control" value={treatmentFilter} onChange={(event) => setTreatmentFilter(event.target.value)}>
            <option value="ALL">All treatments</option>
            {gstTreatments.map((treatment) => (
              <option key={treatment} value={treatment}>
                {treatment}
              </option>
            ))}
          </select>
          <select className="control" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="ALL">All confidence/status</option>
            <option value="HIGH">High confidence</option>
            <option value="MEDIUM">Medium confidence</option>
            <option value="LOW">Low confidence</option>
            <option value="NEEDS_REVIEW">Needs review</option>
            <option value="OVERRIDDEN">Overridden</option>
          </select>
          <select className="control" value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
            <option value="ALL">All severities</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      <div className="max-h-[620px] overflow-auto">
        <table className="min-w-[1180px] w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-[0.08em] text-slate-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Counterparty</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Net</th>
              <th className="px-4 py-3 text-right">GST</th>
              <th className="px-4 py-3">Treatment</th>
              <th className="px-4 py-3">Confidence</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((transaction) => (
              <tr key={transaction.id} className="border-t border-line align-top hover:bg-slate-50/70">
                <td className="px-4 py-3">{transaction.transaction_date}</td>
                <td className="px-4 py-3">{transaction.invoice_no || "Missing"}</td>
                <td className="px-4 py-3">{transaction.counterparty_name || "Missing"}</td>
                <td className="max-w-64 px-4 py-3 text-slate-700">{transaction.description}</td>
                <td className="px-4 py-3 text-right font-medium">{money.format(transaction.net_amount)}</td>
                <td className="px-4 py-3 text-right font-medium">{money.format(transaction.gst_amount)}</td>
                <td className="px-4 py-3">
                  <span className={badge(transaction.max_exception_severity ?? undefined)}>{transaction.gst_treatment}</span>
                  {exceptionCounts[transaction.id] ? <p className="mt-1 text-xs text-slate-500">{exceptionCounts[transaction.id]} exception(s)</p> : null}
                </td>
                <td className="px-4 py-3">{Math.round(transaction.classification_confidence * 100)}%</td>
                <td className="max-w-72 px-4 py-3 text-xs leading-5 text-slate-600">{transaction.classification_reason}</td>
                <td className="px-4 py-3">
                  <button
                    className="button-secondary"
                    onClick={() => {
                      setSelected(transaction);
                      setNewTreatment(transaction.gst_treatment);
                    }}
                  >
                    Override
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4">
          <form className="panel w-full max-w-xl p-5" onSubmit={submitOverride}>
            <h3 className="text-lg font-semibold text-ink">Override GST Treatment</h3>
            <p className="mt-2 text-sm text-slate-600">
              {selected.invoice_no || "Missing invoice"} - {selected.description}
            </p>
            <label className="mt-4 grid gap-1 text-sm font-medium text-slate-700">
              New treatment
              <select className="control" value={newTreatment} onChange={(event) => setNewTreatment(event.target.value as GstTreatment)}>
                {gstTreatments.map((treatment) => (
                  <option key={treatment} value={treatment}>
                    {treatment}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 grid gap-1 text-sm font-medium text-slate-700">
              Override reason
              <textarea className="control min-h-28" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Document accountant rationale for the audit trail." />
            </label>
            {error && <p className="mt-3 text-sm text-risk">{error}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button className="button-secondary" type="button" onClick={() => setSelected(null)}>
                Cancel
              </button>
              <button className="button-primary" type="submit">
                Save override
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
