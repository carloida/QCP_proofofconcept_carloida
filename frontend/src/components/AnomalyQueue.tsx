import { FormEvent, useEffect, useState } from "react";
import { api, ExceptionItem } from "../api";

const statuses = ["Open", "Resolved", "Accepted Risk", "Needs Follow Up", "Excluded From Filing"] as const;

export default function AnomalyQueue({
  anomalies,
  focusExceptionId,
  onRefresh,
  onFocusHandled
}: {
  anomalies: ExceptionItem[];
  focusExceptionId?: number | null;
  onRefresh: () => void;
  onFocusHandled?: () => void;
}) {
  const [editing, setEditing] = useState<ExceptionItem | null>(null);
  const [status, setStatus] = useState<(typeof statuses)[number]>("Resolved");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!focusExceptionId) return;
    const target = anomalies.find((item) => item.id === focusExceptionId);
    if (target) {
      setEditing(target);
      setStatus("Resolved");
      setError("");
      onFocusHandled?.();
    }
  }, [anomalies, focusExceptionId, onFocusHandled]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    try {
      setError("");
      await api.updateExceptionStatus(editing.id, { status, comment });
      setEditing(null);
      setComment("");
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update anomaly.");
    }
  }

  return (
    <section className="panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="badge-human">Human Review</span>
          <h2 className="mt-3 text-lg font-semibold text-ink">Anomaly Queue</h2>
          <p className="mt-1 text-sm text-slate-600">High severity anomalies block final approval. Accepted Risk and Excluded From Filing require a human comment.</p>
        </div>
        <span className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-ink">{anomalies.filter((item) => (item.status ?? "Open") === "Open").length} open</span>
      </div>
      <div className="mt-4 grid gap-3">
        {anomalies.map((item) => {
          const open = (item.status ?? "Open") === "Open";
          const tone = item.severity === "HIGH" && open ? "border-[#D92243]/35 bg-[#D92243]/10" : item.severity === "MEDIUM" && open ? "border-[#F69D39]/35 bg-[#FFF5E5]" : "border-line bg-white";
          return (
            <article key={item.id} className={`rounded-md border p-4 ${tone}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-ink">{item.severity}</span>
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{item.exception_type}</span>
                  {open && <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-risk">Human action required</span>}
                </div>
                <button className="button-secondary" onClick={() => { setEditing(item); setStatus("Resolved"); }}>
                  Update status
                </button>
              </div>
              <p className="mt-2 text-sm font-medium text-ink">{item.message}</p>
              <p className="mt-1 text-xs text-slate-600">Transaction {item.transaction_id} - {item.invoice_no || "Missing invoice"} - Status: {item.status ?? "Open"}</p>
            </article>
          );
        })}
        {!anomalies.length && <p className="text-sm text-slate-500">No anomalies generated yet.</p>}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4">
          <form className="panel w-full max-w-xl p-5" onSubmit={submit}>
            <h3 className="text-lg font-semibold text-ink">Update anomaly status</h3>
            <p className="mt-2 text-sm text-slate-600">{editing.message}</p>
            <label className="mt-4 grid gap-1 text-sm font-medium text-slate-700">
              Resolution status
              <select className="control" value={status} onChange={(event) => setStatus(event.target.value as (typeof statuses)[number])}>
                {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="mt-3 grid gap-1 text-sm font-medium text-slate-700">
              Human comment
              <textarea className="control min-h-24" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Required for Accepted Risk or Excluded From Filing." />
            </label>
            {error && <p className="mt-3 text-sm text-risk">{error}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button className="button-secondary" type="button" onClick={() => setEditing(null)}>Cancel</button>
              <button className="button-primary" type="submit">Save status</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
