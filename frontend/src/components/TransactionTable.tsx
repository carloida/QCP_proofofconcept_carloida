import { useEffect, useState } from "react";
import { AuditLogItem, ExceptionItem, toUiTreatment, Transaction } from "../api";
import TransactionDrawer from "./TransactionDrawer";
import WorkspaceCard from "./WorkspaceCard";

const money = new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" });

function confidenceTone(confidence: number) {
  if (confidence < 0.7) return "bg-[#D92243]/10 text-risk border-[#D92243]/30";
  if (confidence <= 0.85) return "bg-[#FFF5E5] text-[#9A4F10] border-[#F69D39]/35";
  return "bg-[#FFF9EE] text-[#6F5D24] border-[#E0C375]/60";
}

export default function TransactionTable({
  transactions,
  anomalies,
  audit,
  focusTransactionId,
  onFocusHandled,
  onRefresh
}: {
  transactions: Transaction[];
  anomalies: ExceptionItem[];
  audit: AuditLogItem[];
  focusTransactionId?: number | null;
  onFocusHandled?: () => void;
  onRefresh: () => void;
}) {
  const [selected, setSelected] = useState<Transaction | null>(null);

  useEffect(() => {
    if (!focusTransactionId) return;
    const target = transactions.find((tx) => tx.id === focusTransactionId);
    if (target) {
      setSelected(target);
      onFocusHandled?.();
    }
  }, [focusTransactionId, onFocusHandled, transactions]);

  return (
    <WorkspaceCard
      badge="AI Task"
      badgeClass="badge-ai"
      title="GST Treatment Classification"
      description="AI proposes treatment; human accountant approves, overrides, or sends items for follow-up."
      status={<span className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink">{transactions.length} transactions</span>}
      bodyClassName="p-0"
    >
      <div className="max-h-[640px] overflow-auto">
        <table className="min-w-[1320px] w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-[0.08em] text-slate-500">
            <tr>
              {["transaction_id", "date", "supplier_or_customer", "description", "net_amount", "gst_amount", "gross_amount", "currency", "transaction_type", "ai_gst_treatment", "confidence", "evidence_status", "anomaly_flag", "human_override", "approval_status"].map((heading) => (
                <th key={heading} className="px-4 py-3">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => {
              const txAnomalies = anomalies.filter((item) => item.transaction_id === tx.id && (item.status ?? "Open") === "Open");
              const hasHigh = txAnomalies.some((item) => item.severity === "HIGH");
              const evidence = !tx.invoice_no ? "missing evidence" : tx.gst_treatment === "ZERO_RATED_SUPPLY" && !`${tx.description}`.toLowerCase().includes("evidence") ? "export evidence missing" : "support tracked";
              return (
                <tr key={tx.id} className="cursor-pointer border-t border-line align-top hover:bg-slate-50" onClick={() => setSelected(tx)}>
                  <td className="px-4 py-3 font-semibold text-ink">{tx.id}</td>
                  <td className="px-4 py-3">{tx.transaction_date}</td>
                  <td className="px-4 py-3">{tx.counterparty_name || "Missing"}</td>
                  <td className="max-w-64 px-4 py-3 text-slate-700">{tx.description}</td>
                  <td className="px-4 py-3 text-right">{money.format(tx.net_amount)}</td>
                  <td className="px-4 py-3 text-right">{money.format(tx.gst_amount)}</td>
                  <td className="px-4 py-3 text-right">{money.format(tx.gross_amount)}</td>
                  <td className="px-4 py-3">{tx.currency}</td>
                  <td className="px-4 py-3">{tx.transaction_type}</td>
                  <td className="px-4 py-3">{toUiTreatment(tx.gst_treatment)}</td>
                  <td className="px-4 py-3"><span className={`rounded-md border px-2 py-1 text-xs font-semibold ${confidenceTone(tx.classification_confidence)}`}>{Math.round(tx.classification_confidence * 100)}%</span></td>
                  <td className="px-4 py-3"><span className={`rounded-md border px-2 py-1 text-xs font-semibold ${evidence.includes("missing") ? "border-[#F69D39]/35 bg-[#FFF5E5] text-[#9A4F10]" : "border-[#E0C375]/60 bg-[#FFF9EE] text-[#6F5D24]"}`}>{evidence}</span></td>
                  <td className="px-4 py-3"><span className={`rounded-md border px-2 py-1 text-xs font-semibold ${hasHigh ? "border-[#D92243]/30 bg-[#D92243]/10 text-risk" : txAnomalies.length ? "border-[#F69D39]/35 bg-[#FFF5E5] text-[#9A4F10]" : "border-[#E0C375]/60 bg-[#FFF9EE] text-[#6F5D24]"}`}>{hasHigh ? "high anomaly" : txAnomalies.length ? "human action required" : "clear"}</span></td>
                  <td className="px-4 py-3">{tx.review_status === "OVERRIDDEN" ? "override saved" : "none"}</td>
                  <td className="px-4 py-3"><span className={`rounded-md border px-2 py-1 text-xs font-semibold ${tx.review_status === "APPROVED" ? "border-[#E0C375]/60 bg-[#FFF9EE] text-[#6F5D24]" : "border-[#F69D39]/35 bg-[#FFF5E5] text-[#9A4F10]"}`}>{tx.review_status === "APPROVED" ? "approved" : "review needed"}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selected && (
        <TransactionDrawer
          transaction={selected}
          anomalies={anomalies.filter((item) => item.transaction_id === selected.id)}
          auditEvents={audit.filter((event) => event.transaction_id === selected.id).map((event) => `${event.action.replaceAll("_", " ")} - ${event.details}`)}
          onClose={() => setSelected(null)}
          onRefresh={onRefresh}
        />
      )}
    </WorkspaceCard>
  );
}
