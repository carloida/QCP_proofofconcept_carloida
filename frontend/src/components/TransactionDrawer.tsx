import { FormEvent, useMemo, useState } from "react";
import { api, ExceptionItem, gstTreatments, GstTreatment, toUiTreatment, Transaction } from "../api";

export default function TransactionDrawer({
  transaction,
  anomalies,
  auditEvents,
  onClose,
  onRefresh
}: {
  transaction: Transaction;
  anomalies: ExceptionItem[];
  auditEvents: string[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [newTreatment, setNewTreatment] = useState<GstTreatment>(transaction.gst_treatment);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("Human accountant reviewed classification and supporting evidence.");
  const [error, setError] = useState("");
  const changed = newTreatment !== transaction.gst_treatment;
  const supportingStatus = useMemo(() => {
    const text = `${transaction.description ?? ""} ${transaction.invoice_no ?? ""}`.toLowerCase();
    if (!transaction.invoice_no) return "Missing tax invoice";
    if (transaction.gst_treatment === "ZERO_RATED_SUPPLY" && !text.includes("evidence")) return "Missing export evidence";
    if (transaction.transaction_type === "PURCHASE" && transaction.gst_amount > 0) return "Tax invoice or import permit required";
    return "Support appears available";
  }, [transaction]);

  async function submitOverride(event: FormEvent) {
    event.preventDefault();
    if (changed && reason.trim().length < 8) {
      setError("Human overrides require a reason of at least 8 characters.");
      return;
    }
    try {
      setError("");
      if (changed) {
        await api.override(transaction.id, { new_treatment: newTreatment, reason, user_name: "Carlo Emilio Ida" });
      }
      await api.approveTransaction(transaction.id, { user_name: "Carlo Emilio Ida", comment });
      onRefresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save review.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40">
      <aside className="h-full w-full max-w-2xl overflow-auto bg-white p-6 shadow-panel">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="badge-human">Human Review</span>
            <h2 className="mt-3 text-xl font-semibold text-ink">Transaction {transaction.id}</h2>
            <p className="mt-1 text-sm text-slate-600">{transaction.description}</p>
          </div>
          <button className="button-secondary" onClick={onClose}>Close</button>
        </div>

        <div className="mt-5 grid gap-4">
          <section className="rounded-md border border-line p-4">
            <h3 className="text-sm font-semibold text-ink">Original transaction details</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-slate-500">Date</dt><dd className="font-medium text-ink">{transaction.transaction_date}</dd></div>
              <div><dt className="text-slate-500">Invoice</dt><dd className="font-medium text-ink">{transaction.invoice_no || "Missing"}</dd></div>
              <div><dt className="text-slate-500">Supplier / customer</dt><dd className="font-medium text-ink">{transaction.counterparty_name || "Missing"}</dd></div>
              <div><dt className="text-slate-500">Currency</dt><dd className="font-medium text-ink">{transaction.currency}</dd></div>
              <div><dt className="text-slate-500">Net</dt><dd className="font-medium text-ink">{transaction.net_amount.toLocaleString("en-SG", { style: "currency", currency: "SGD" })}</dd></div>
              <div><dt className="text-slate-500">GST</dt><dd className="font-medium text-ink">{transaction.gst_amount.toLocaleString("en-SG", { style: "currency", currency: "SGD" })}</dd></div>
            </dl>
          </section>

          <section className="rounded-md border border-line p-4">
            <h3 className="text-sm font-semibold text-ink">AI proposed GST treatment</h3>
            <p className="mt-2 text-sm"><span className="font-semibold text-ink">{toUiTreatment(transaction.gst_treatment)}</span> at {Math.round(transaction.classification_confidence * 100)}% confidence</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{transaction.classification_reason}</p>
            <p className="mt-2 text-sm text-slate-600">Supporting document status: <span className="font-semibold text-ink">{supportingStatus}</span></p>
          </section>

          <section className="rounded-md border border-line p-4">
            <h3 className="text-sm font-semibold text-ink">Anomaly findings</h3>
            <div className="mt-3 grid gap-2">
              {anomalies.map((item) => <p key={item.id} className="rounded-md bg-slate-50 p-2 text-sm text-slate-700">{item.severity}: {item.message}</p>)}
              {!anomalies.length && <p className="text-sm text-slate-500">No anomaly findings for this transaction.</p>}
            </div>
          </section>

          <form className="rounded-md border border-line p-4" onSubmit={submitOverride}>
            <h3 className="text-sm font-semibold text-ink">Human decision</h3>
            <label className="mt-3 grid gap-1 text-sm font-medium text-slate-700">
              Human override dropdown
              <select className="control" value={newTreatment} onChange={(event) => setNewTreatment(event.target.value as GstTreatment)}>
                {gstTreatments.map((treatment) => <option key={treatment} value={treatment}>{toUiTreatment(treatment)}</option>)}
              </select>
            </label>
            <label className="mt-3 grid gap-1 text-sm font-medium text-slate-700">
              Mandatory comment box if override is made
              <textarea className="control min-h-24" value={changed ? reason : comment} onChange={(event) => changed ? setReason(event.target.value) : setComment(event.target.value)} />
            </label>
            {error && <p className="mt-3 text-sm text-risk">{error}</p>}
            <button className="button-primary mt-4" type="submit">Approve classification</button>
          </form>

          <section className="rounded-md border border-line p-4">
            <h3 className="text-sm font-semibold text-ink">Audit history for this transaction</h3>
            <div className="mt-3 grid gap-2">
              {auditEvents.map((event) => <p key={event} className="text-sm text-slate-600">{event}</p>)}
              {!auditEvents.length && <p className="text-sm text-slate-500">No transaction-specific audit events yet.</p>}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
