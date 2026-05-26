import { useState } from "react";
import { AiUsageSummary } from "../api";
import { ImpactMetrics, formatMinutesAsHours, formatPercent, formatSgd, getMetricStatusColor } from "../metrics";

function toneClass(tone: ReturnType<typeof getMetricStatusColor>) {
  switch (tone) {
    case "good":
      return "border-[#E0C375]/70 bg-[#FFF9EE] text-[#6F5D24]";
    case "warning":
      return "border-[#F69D39]/35 bg-[#FFF5E5] text-[#9A4F10]";
    case "critical":
      return "border-[#D92243]/35 bg-[#D92243]/10 text-risk";
    default:
      return "border-line bg-white text-ink";
  }
}

function progressTone(tone: ReturnType<typeof getMetricStatusColor>) {
  if (tone === "critical") return "bg-[#D92243]";
  if (tone === "warning") return "bg-[#F69D39]";
  return "bg-[#E0C375]";
}

function MetricCard({
  label,
  value,
  status,
  helper,
  tone,
  progress
}: {
  label: string;
  value: string;
  status?: string;
  helper: string;
  tone: ReturnType<typeof getMetricStatusColor>;
  progress?: number | null;
}) {
  return (
    <article className={`rounded-md border p-4 ${toneClass(tone)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-75">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
        </div>
        {status && <span className="rounded-md border border-current/20 bg-white/65 px-2 py-1 text-xs font-semibold">{status}</span>}
      </div>
      {typeof progress === "number" && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80">
          <div className={`h-full ${progressTone(tone)}`} style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      )}
      <p className="mt-3 text-xs leading-5 text-slate-600">{helper}</p>
    </article>
  );
}

export default function ImpactEvaluationPanel({ metrics, aiUsage }: { metrics: ImpactMetrics; aiUsage?: AiUsageSummary | null }) {
  const [open, setOpen] = useState(false);
  const hasTransactions = metrics.totalTransactions > 0;
  const blockerTone = getMetricStatusColor("blockers", metrics.complianceBlockerCount === null ? null : 1, metrics.complianceBlockerCount ?? 0);
  const readinessTone = getMetricStatusColor("readiness", metrics.approvalReadinessScore === null ? null : metrics.approvalReadinessScore / 100);
  const auditTone = getMetricStatusColor("audit", metrics.auditCompletenessRate);
  const blockerStatus =
    metrics.complianceBlockerCount === null ? "Pending setup" : metrics.complianceBlockerCount === 0 ? "Clear" : metrics.complianceBlockerCount <= 2 ? "Needs Attention" : "Blocked";

  return (
    <section className="panel overflow-hidden">
      <button
        className="flex w-full flex-col gap-3 bg-[#FFFBF5] p-4 text-left transition hover:bg-[#FFF5E5] lg:flex-row lg:items-center lg:justify-between"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9A4F10]">Impact & Evaluation</p>
          <h2 className="mt-1 text-lg font-semibold text-ink">Reliability, readiness, and compliance control</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            AI-assisted processing is measured by reliability, review reduction, approval readiness, and audit control.
          </p>
        </div>
        <span className="button-secondary w-fit px-3 py-1">{open ? "Collapse" : "Expand"}</span>
      </button>

      {!hasTransactions ? (
        <div className="border-t border-line p-5">
          <div className="rounded-md border border-[#E0C375]/70 bg-[#FFF9EE] p-4">
            <p className="text-sm font-semibold text-ink">Impact metrics will appear after transaction data is uploaded.</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Pending transaction data. Approval readiness is Not Ready, and time or cost savings are not estimated yet.
            </p>
          </div>
        </div>
      ) : (
        <div className="border-t border-line p-4">
          <div className="grid gap-3 lg:grid-cols-4">
            <MetricCard
              label="Approval Readiness"
              value={metrics.approvalReadinessScore === null ? "Pending data" : `${metrics.approvalReadinessScore}%`}
              status={metrics.approvalReadinessStatus}
              tone={readinessTone}
              progress={metrics.approvalReadinessScore}
              helper="Weighted score based on ingestion, classification, anomaly resolution, human review, F5 validation, and audit completeness."
            />
            <MetricCard
              label="Compliance Blockers"
              value={metrics.complianceBlockerCount === null ? "Pending setup" : `${metrics.complianceBlockerCount} blockers`}
              status={blockerStatus}
              tone={blockerTone}
              helper="Unresolved items that prevent final approval or export readiness."
            />
            <MetricCard
              label="AI-Human Agreement"
              value={formatPercent(metrics.aiHumanAgreementRate)}
              status={metrics.aiHumanAgreementRate === null ? "Pending review data" : metrics.aiHumanAgreementRate >= 0.9 ? "Strong" : metrics.aiHumanAgreementRate >= 0.75 ? "Needs monitoring" : "Needs review"}
              tone={getMetricStatusColor("agreement", metrics.aiHumanAgreementRate)}
              helper="Share of reviewed transactions where the AI recommendation matched the final human-approved GST treatment."
            />
            <MetricCard
              label="Estimated Time Saved"
              value={formatMinutesAsHours(metrics.estimatedTimeSavedMinutes)}
              status={metrics.estimatedTimeSavedPercent === null ? "Pending transaction data" : `${formatPercent(metrics.estimatedTimeSavedPercent)} reduction`}
              tone="neutral"
              helper="Estimated against configurable manual processing assumptions. This is a planning estimate, not a guaranteed saving."
            />
          </div>

          {open && (
            <>
              <div className="mt-3 grid gap-3 lg:grid-cols-4">
                <MetricCard
                  label="Straight-Through Processing"
                  value={formatPercent(metrics.straightThroughProcessingRate)}
                  status={metrics.straightThroughProcessingRate === null ? "Pending data" : metrics.straightThroughProcessingRate >= 0.85 ? "Strong automation" : metrics.straightThroughProcessingRate >= 0.6 ? "Moderate automation" : "Review bottleneck"}
                  tone={getMetricStatusColor("straightThrough", metrics.straightThroughProcessingRate)}
                  helper="Transactions that can proceed without manual review because no critical issue, anomaly, or low-confidence classification was detected."
                />
                <MetricCard
                  label="Manual Review Scope Reduced"
                  value={formatPercent(metrics.manualReviewReductionRate)}
                  tone="neutral"
                  helper="Estimated reduction in transaction-level manual review scope. Accountants retain final review and approval responsibility."
                />
                <MetricCard
                  label="Human Override Rate"
                  value={formatPercent(metrics.humanOverrideRate)}
                  status={metrics.humanOverrideRate === null ? "Pending review data" : metrics.humanOverrideRate <= 0.1 ? "Low" : metrics.humanOverrideRate <= 0.25 ? "Moderate" : "High"}
                  tone={getMetricStatusColor("override", metrics.humanOverrideRate)}
                  helper="Percentage of reviewed transactions where the accountant changed the AI-recommended GST treatment."
                />
                <MetricCard
                  label="Estimated Labor Cost Saved"
                  value={formatSgd(metrics.estimatedLaborCostSavedSgd)}
                  status="Per filing cycle"
                  tone="neutral"
                  helper="Based on estimated time saved and configurable hourly cost assumption."
                />
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-4">
                <MetricCard
                  label="AI Token Usage"
                  value={(aiUsage?.summary.total_tokens ?? 0).toLocaleString()}
                  status={`${aiUsage?.summary.request_count ?? 0} requests`}
                  tone="neutral"
                  helper="Total prompt and completion tokens recorded for real AI-enabled agent requests in this period."
                />
                <MetricCard
                  label="Estimated AI Cost"
                  value={
                    aiUsage?.summary.estimated_cost_sgd !== null && aiUsage?.summary.estimated_cost_sgd !== undefined
                      ? `SGD ${aiUsage.summary.estimated_cost_sgd.toFixed(4)}`
                      : aiUsage?.summary.estimated_cost_usd !== null && aiUsage?.summary.estimated_cost_usd !== undefined
                        ? `USD ${aiUsage.summary.estimated_cost_usd.toFixed(4)}`
                        : "Cost estimate unavailable"
                  }
                  status="Configurable pricing"
                  tone="neutral"
                  helper="Shown only when pricing environment variables are configured; otherwise token counts remain visible."
                />
                <MetricCard
                  label="Last AI Run"
                  value={aiUsage?.summary.last_run ? aiUsage.summary.last_run.agent_name.replaceAll("_", " ") : "No run yet"}
                  status={aiUsage?.summary.last_run?.status ?? "Pending"}
                  tone={aiUsage?.summary.last_run?.fallback_used ? "warning" : "neutral"}
                  helper={aiUsage?.summary.last_run ? `${aiUsage.summary.last_run.latency_ms} ms latency` : "Run one of the two AI-enabled agents to populate runtime telemetry."}
                />
                <MetricCard
                  label="Fallback Count"
                  value={`${aiUsage?.summary.fallback_count ?? 0}`}
                  status={(aiUsage?.summary.fallback_count ?? 0) > 0 ? "Fallback used" : "Clear"}
                  tone={(aiUsage?.summary.fallback_count ?? 0) > 0 ? "warning" : "good"}
                  helper="Fallback keeps the workflow running when AI is not configured, fails, or returns invalid output."
                />
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_380px]">
                <MetricCard
                  label="Audit Completeness"
                  value={formatPercent(metrics.auditCompletenessRate)}
                  status={metrics.auditCompletenessRate === null ? "Pending workflow activity" : metrics.auditCompletenessRate >= 0.95 ? "Strong" : metrics.auditCompletenessRate >= 0.8 ? "Needs monitoring" : "Incomplete"}
                  tone={auditTone}
                  progress={metrics.auditCompletenessRate === null ? null : metrics.auditCompletenessRate * 100}
                  helper="Share of required workflow events captured in the audit trail."
                />
                <details className="rounded-md border border-line bg-white p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-ink">Assumptions used for time and cost estimates</summary>
                  <dl className="mt-3 grid gap-2 text-sm text-slate-600">
                    <div className="flex justify-between gap-3"><dt>Manual baseline</dt><dd className="font-semibold text-ink">{metrics.assumptions.manualBaselineMinutesPerTransaction} min / transaction</dd></div>
                    <div className="flex justify-between gap-3"><dt>Clean quick scan</dt><dd className="font-semibold text-ink">{metrics.assumptions.quickScanMinutesPerCleanTransaction} min / transaction</dd></div>
                    <div className="flex justify-between gap-3"><dt>Detailed review</dt><dd className="font-semibold text-ink">{metrics.assumptions.detailedReviewMinutesPerReviewTransaction} min / review</dd></div>
                    <div className="flex justify-between gap-3"><dt>Anomaly resolution</dt><dd className="font-semibold text-ink">{metrics.assumptions.anomalyResolutionMinutesPerAnomaly} min / anomaly</dd></div>
                    <div className="flex justify-between gap-3"><dt>Hourly cost</dt><dd className="font-semibold text-ink">SGD {metrics.assumptions.accountantHourlyCostSgd}/hour</dd></div>
                  </dl>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    This metric measures workflow efficiency, not guaranteed tax compliance. AI recommendations remain subject to human review.
                  </p>
                </details>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
