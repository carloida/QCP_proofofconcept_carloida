import { AuditLogItem, ExceptionItem, GstF5Summary, Transaction, WorkflowStep } from "../api";
import { recentAudit } from "../workflow";

export default function CompliancePanel({
  currentStep,
  transactions,
  anomalies,
  summary,
  audit,
  readiness,
  activeSourceSummary
}: {
  currentStep: WorkflowStep;
  transactions: Transaction[];
  anomalies: ExceptionItem[];
  summary: GstF5Summary | null;
  audit: AuditLogItem[];
  readiness: string;
  activeSourceSummary?: string[];
}) {
  const open = anomalies.filter((item) => (item.status ?? "Open") === "Open");
  const humanActions = [
    ...transactions.filter((tx) => tx.classification_confidence < 0.7 || tx.review_status === "NEEDS_REVIEW").slice(0, 3).map((tx) => `Review transaction ${tx.id}: ${tx.description}`),
    ...open.filter((item) => item.severity === "HIGH").slice(0, 3).map((item) => `Resolve ${item.exception_type} on transaction ${item.transaction_id}`)
  ];

  return (
    <aside className="panel sticky top-4 h-fit p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Compliance Panel</h2>
        <span className="rounded-md border border-[#F69D39]/35 bg-[#FFF5E5] px-2 py-1 text-xs font-semibold text-[#9A4F10]">{readiness}</span>
      </div>
      <div className="mt-5 grid gap-5">
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">AI summary for current step</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{currentStep.summary}</p>
        </section>
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Human required actions</p>
          <div className="mt-2 grid gap-2">
            {humanActions.length ? humanActions.map((item) => <p key={item} className="rounded-md border border-[#F69D39]/35 bg-[#FFF5E5] p-2 text-sm text-[#9A4F10]">{item}</p>) : <p className="text-sm text-slate-500">No immediate human action required for this step.</p>}
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
