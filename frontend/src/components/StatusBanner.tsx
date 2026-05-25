import { FilingPeriod, WorkflowStep } from "../api";

export default function StatusBanner({
  period,
  currentStep,
  blockingIssues,
  readiness,
  humanReviewsRequired,
  highSeverityAnomalies,
  transactionCount
}: {
  period: FilingPeriod | null;
  currentStep: WorkflowStep;
  blockingIssues: number;
  readiness: string;
  humanReviewsRequired: number;
  highSeverityAnomalies: number;
  transactionCount: number;
}) {
  const blocked = blockingIssues > 0;
  const statusLabel = !period ? "Setup required" : blocked ? "Final approval blocked" : "Accountant review required";
  return (
    <section className={`panel border-l-4 p-5 ${blocked ? "border-l-risk" : "border-l-accent"}`}>
      <div className="flex flex-col gap-3 border-b border-line pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9A4F10]">Workflow status</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">{readiness}</h2>
        </div>
        <span className={`rounded-md border px-3 py-2 text-sm font-semibold ${blocked ? "border-[#D92243]/30 bg-[#D92243]/10 text-risk" : "border-[#F69D39]/35 bg-[#FFF5E5] text-[#9A4F10]"}`}>
          {statusLabel}
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Reporting Quarter</p>
          <p className="mt-1 text-base font-semibold text-ink">{period?.name ?? "Not created"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">GST Registration</p>
          <p className="mt-1 text-base font-semibold text-ink">{period ? "Pending confirmation" : "Not confirmed"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Current Owner</p>
          <p className="mt-1 text-base font-semibold text-ink">{currentStep.owner}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Blocking Issues</p>
          <p className={`mt-1 text-base font-semibold ${blockingIssues ? "text-risk" : "text-accent"}`}>{blockingIssues}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Human Reviews Required</p>
          <p className="mt-1 text-base font-semibold text-ink">{humanReviewsRequired}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Transactions Ingested</p>
          <p className="mt-1 text-base font-semibold text-ink">{transactionCount}</p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        {!period
          ? "Create a filing period and upload your transaction data to begin the GST F5 workflow."
          : blockingIssues
            ? `F5 computation can be reviewed, but final approval is blocked until unresolved high-severity anomalies are cleared. ${highSeverityAnomalies} high-severity anomalies require accountant action.`
            : period.status === "APPROVED"
            ? "Approved for manual submission via IRAS myTax Portal. This prototype does not submit directly to IRAS."
            : transactionCount
              ? `AI has completed initial classification. Human review is required for ${humanReviewsRequired} transactions. No automatic IRAS submission will occur.`
              : "No transactions have been uploaded yet. Upload a CSV to start classification and reconciliation."}
      </p>
    </section>
  );
}
