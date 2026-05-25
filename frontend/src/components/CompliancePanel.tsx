import { AuditLogItem, ExceptionItem, GstF5Summary, Transaction, WorkflowStep } from "../api";
import { recentAudit } from "../workflow";

export default function CompliancePanel({
  currentStep,
  transactions,
  anomalies,
  summary,
  audit,
  readiness,
  activeSourceSummary,
  onResolveException,
  onReviewTransaction,
  onPrimaryAction,
  primaryActionLabel = "Go to required action"
}: {
  currentStep: WorkflowStep;
  transactions: Transaction[];
  anomalies: ExceptionItem[];
  summary: GstF5Summary | null;
  audit: AuditLogItem[];
  readiness: string;
  activeSourceSummary?: string[];
  onResolveException?: (exceptionId: number) => void;
  onReviewTransaction?: (transactionId: number) => void;
  onPrimaryAction?: () => void;
  primaryActionLabel?: string;
}) {
  const open = anomalies.filter((item) => (item.status ?? "Open") === "Open");
  const transactionActions = transactions
    .filter((tx) => tx.classification_confidence < 0.7 || tx.review_status === "NEEDS_REVIEW")
    .slice(0, 3)
    .map((tx) => ({ id: tx.id, label: `Review transaction ${tx.id}: ${tx.description}` }));
  const exceptionActions = open
    .filter((item) => item.severity === "HIGH")
    .slice(0, 3)
    .map((item) => ({ id: item.id, label: `Resolve ${item.exception_type} on transaction ${item.transaction_id}` }));

  return (
    <aside className="panel sticky top-5 flex max-h-[calc(100vh-2.5rem)] flex-col overflow-hidden">
      <div className="shrink-0 bg-[#1F2A44] p-5 text-white">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Compliance Panel</h2>
          <span className="rounded-md border border-white/30 bg-white px-2 py-1 text-xs font-semibold text-[#1F2A44]">{readiness}</span>
        </div>
        <p className="mt-2 text-xs leading-5 text-white/75">Action queue for reviews, blockers, source status, and audit events.</p>
      </div>
      <div className="grid flex-1 content-start gap-5 overflow-y-auto p-5">
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">AI summary for current step</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{currentStep.summary}</p>
          {onPrimaryAction && (
            <button className="button-primary mt-3 w-full" onClick={onPrimaryAction}>
              {primaryActionLabel}
            </button>
          )}
        </section>
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Human required actions</p>
          <div className="mt-2 grid gap-2">
            {exceptionActions.map((item) => (
              <button key={`exception-${item.id}`} className="rounded-md border border-[#F69D39]/35 bg-[#FFF5E5] p-2 text-left text-sm text-[#9A4F10] transition hover:border-[#E58B27] hover:bg-[#FFE9C7]" onClick={() => onResolveException?.(item.id)}>
                {item.label}
              </button>
            ))}
            {transactionActions.map((item) => (
              <button key={`transaction-${item.id}`} className="rounded-md border border-[#F69D39]/35 bg-[#FFF5E5] p-2 text-left text-sm text-[#9A4F10] transition hover:border-[#E58B27] hover:bg-[#FFE9C7]" onClick={() => onReviewTransaction?.(item.id)}>
                {item.label}
              </button>
            ))}
            {!exceptionActions.length && !transactionActions.length && <p className="text-sm text-slate-500">No immediate human action required for this step.</p>}
          </div>
        </section>
        {activeSourceSummary && (
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Active ingestion sources</p>
            <div className="mt-2 grid gap-2">
              {activeSourceSummary.length ? activeSourceSummary.map((item) => <p key={item} className="rounded-md border border-line bg-slate-50 p-2 text-sm text-slate-600">{item}</p>) : <p className="text-sm text-slate-500">No source selected yet.</p>}
            </div>
          </section>
        )}
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Unresolved issues</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{open.length}</p>
          <p className="text-xs text-slate-500">{open.filter((item) => item.severity === "HIGH").length} high severity blockers</p>
        </section>
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">F5 readiness</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {summary
              ? `Box 8 is SGD ${summary.box_8_net_gst_payable.toLocaleString("en-SG", { minimumFractionDigits: 2 })}. Box 8 equals Box 6 minus Box 7.`
              : "F5 computation has not started."}
          </p>
        </section>
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Recent audit events</p>
          <div className="mt-2 grid gap-2">
            {recentAudit(audit).map((event) => (
              <div key={event.id} className="border-b border-line pb-2 last:border-b-0">
                <p className="text-sm font-semibold text-ink">{event.action.replaceAll("_", " ")}</p>
                <p className="text-xs text-slate-500">{event.actor_type ?? event.actor} - {new Date(event.created_at).toLocaleString()}</p>
              </div>
            ))}
            {!audit.length && <p className="text-sm text-slate-500">No audit events yet.</p>}
          </div>
        </section>
      </div>
    </aside>
  );
}
