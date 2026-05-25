import { AuditLogItem, ExceptionItem, FilingPeriod, GstF5Summary, Transaction } from "./api";

export const metricAssumptions = {
  manualBaselineMinutesPerTransaction: 2.5,
  quickScanMinutesPerCleanTransaction: 0.25,
  detailedReviewMinutesPerReviewTransaction: 4,
  anomalyResolutionMinutesPerAnomaly: 6,
  accountantHourlyCostSgd: 60
};

export type MetricTone = "neutral" | "good" | "warning" | "critical";
export type ReadinessStatus = "Not Ready" | "Review Required" | "Ready for Approval" | "Approved for Manual Submission";

export type ImpactMetrics = {
  periodId: number;
  totalTransactions: number;
  approvalReadinessScore: number | null;
  approvalReadinessStatus: ReadinessStatus;
  complianceBlockerCount: number | null;
  aiHumanAgreementRate: number | null;
  humanOverrideRate: number | null;
  straightThroughProcessingRate: number | null;
  manualReviewReductionRate: number | null;
  estimatedTimeSavedMinutes: number | null;
  estimatedTimeSavedPercent: number | null;
  estimatedLaborCostSavedSgd: number | null;
  auditCompletenessRate: number | null;
  assumptions: typeof metricAssumptions;
  inputs: {
    classifiedTransactions: number;
    reviewRequiredTransactions: number;
    completedRequiredReviews: number;
    reviewedTransactions: number;
    humanOverrides: number;
    cleanTransactions: number;
    unresolvedHighSeverityAnomalies: number;
    criticalValidationErrors: number;
    failedF5ValidationChecks: number;
    missingFinalApprovalConfirmation: number;
    requiredAuditEvents: number;
    loggedRequiredAuditEvents: number;
    f5ValidationPassed: boolean;
  };
};

export function formatPercent(value: number | null) {
  if (value === null) return "Pending data";
  return `${(value * 100).toFixed(1)}%`;
}

export function formatMinutesAsHours(minutes: number | null) {
  if (minutes === null) return "Pending data";
  if (minutes < 60) return `${Math.max(0, Math.round(minutes))} min saved`;
  return `${(minutes / 60).toFixed(1)} hours saved`;
}

export function formatSgd(value: number | null) {
  if (value === null) return "Pending data";
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    maximumFractionDigits: 0
  }).format(Math.max(0, value));
}

export function getReadinessStatus(score: number | null, period?: FilingPeriod | null): ReadinessStatus {
  if (period?.status === "APPROVED" || period?.status === "EXPORTED") return "Approved for Manual Submission";
  if (score === null || score < 50) return "Not Ready";
  if (score < 90) return "Review Required";
  if (score < 100) return "Ready for Approval";
  return "Approved for Manual Submission";
}

export function getMetricStatusColor(metric: string, value: number | null, blockers = 0): MetricTone {
  if (value === null) return "neutral";
  if (metric === "blockers") {
    if (blockers >= 3) return "critical";
    if (blockers > 0) return "warning";
    return "good";
  }
  if (metric === "override") {
    if (value > 0.25) return "critical";
    if (value > 0.1) return "warning";
    return "good";
  }
  if (metric === "agreement") {
    if (value >= 0.9) return "good";
    if (value >= 0.75) return "warning";
    return "critical";
  }
  if (metric === "straightThrough") {
    if (value >= 0.85) return "good";
    if (value >= 0.6) return "warning";
    return "critical";
  }
  if (metric === "audit") {
    if (value >= 0.95) return "good";
    if (value >= 0.8) return "warning";
    return "critical";
  }
  if (metric === "readiness") {
    if (value >= 0.9) return "good";
    if (value >= 0.5) return "warning";
    return "critical";
  }
  return "neutral";
}

export function calculateImpactMetrics(args: {
  period: FilingPeriod;
  transactions: Transaction[];
  anomalies: ExceptionItem[];
  summary: GstF5Summary | null;
  audit: AuditLogItem[];
  f5Reviewed: boolean;
}): ImpactMetrics {
  const { period, transactions, anomalies, summary, audit, f5Reviewed } = args;
  const totalTransactions = transactions.length;
  const anomalyTransactionIds = new Set(anomalies.map((item) => item.transaction_id));
  const openHighSeverity = anomalies.filter((item) => item.severity === "HIGH" && (item.status ?? "Open") === "Open").length;
  const totalHighSeverity = anomalies.filter((item) => item.severity === "HIGH").length;
  const resolvedHighSeverity = anomalies.filter((item) => item.severity === "HIGH" && (item.status ?? "Open") !== "Open").length;
  const reviewedTransactions = transactions.filter((tx) => tx.review_status === "APPROVED" || tx.review_status === "OVERRIDDEN").length;
  const humanOverrides = transactions.filter((tx) => tx.review_status === "OVERRIDDEN").length;
  const reviewRequiredTransactions = transactions.filter(
    (tx) =>
      tx.review_status === "NEEDS_REVIEW" ||
      tx.review_status === "APPROVED" ||
      tx.review_status === "OVERRIDDEN" ||
      tx.gst_treatment === "REVIEW_REQUIRED" ||
      tx.classification_confidence < 0.7
  ).length;
  const pendingRequiredReviews = transactions.filter(
    (tx) =>
      (tx.review_status === "NEEDS_REVIEW" || tx.gst_treatment === "REVIEW_REQUIRED" || tx.classification_confidence < 0.7) &&
      tx.review_status !== "APPROVED" &&
      tx.review_status !== "OVERRIDDEN"
  ).length;
  const classifiedTransactions = transactions.filter((tx) => tx.gst_treatment !== "REVIEW_REQUIRED").length;
  const cleanTransactions = transactions.filter(
    (tx) =>
      !anomalyTransactionIds.has(tx.id) &&
      tx.max_exception_severity !== "HIGH" &&
      tx.classification_confidence >= 0.7 &&
      tx.review_status !== "NEEDS_REVIEW" &&
      tx.gst_treatment !== "REVIEW_REQUIRED"
  ).length;

  const f5ValidationPassed = Boolean(
    summary &&
      summary.transaction_count > 0 &&
      nearlyEqual(summary.box_4_total_supplies, summary.box_1_standard_rated_supplies + summary.box_2_zero_rated_supplies + summary.box_3_exempt_supplies) &&
      nearlyEqual(summary.box_8_net_gst_payable, summary.box_6_output_tax_due - summary.box_7_input_tax_claimed)
  );
  const failedF5ValidationChecks = summary && summary.transaction_count > 0 && !f5ValidationPassed ? 1 : 0;
  const missingFinalApprovalConfirmation = period.status === "APPROVED" || period.status === "EXPORTED" ? 0 : 1;
  const complianceBlockerCount =
    totalTransactions > 0
      ? openHighSeverity + pendingRequiredReviews + failedF5ValidationChecks + missingFinalApprovalConfirmation
      : null;

  const expectedAuditEvents = buildExpectedAuditEvents({
    totalTransactions,
    reviewRequiredTransactions,
    humanOverrides,
    hasSummary: Boolean(summary && summary.transaction_count > 0),
    f5Reviewed,
    approved: period.status === "APPROVED" || period.status === "EXPORTED"
  });
  const loggedRequiredAuditEvents = expectedAuditEvents.filter((event) => hasAuditEvent(audit, event)).length;
  const auditCompletenessRate = expectedAuditEvents.length ? loggedRequiredAuditEvents / expectedAuditEvents.length : null;

  if (totalTransactions === 0) {
    return {
      periodId: period.id,
      totalTransactions,
      approvalReadinessScore: 0,
      approvalReadinessStatus: "Not Ready",
      complianceBlockerCount,
      aiHumanAgreementRate: null,
      humanOverrideRate: null,
      straightThroughProcessingRate: null,
      manualReviewReductionRate: null,
      estimatedTimeSavedMinutes: null,
      estimatedTimeSavedPercent: null,
      estimatedLaborCostSavedSgd: null,
      auditCompletenessRate,
      assumptions: metricAssumptions,
      inputs: {
        classifiedTransactions,
        reviewRequiredTransactions,
        completedRequiredReviews: reviewedTransactions,
        reviewedTransactions,
        humanOverrides,
        cleanTransactions,
        unresolvedHighSeverityAnomalies: openHighSeverity,
        criticalValidationErrors: 0,
        failedF5ValidationChecks,
        missingFinalApprovalConfirmation,
        requiredAuditEvents: expectedAuditEvents.length,
        loggedRequiredAuditEvents,
        f5ValidationPassed
      }
    };
  }

  const aiHumanAgreementRate = reviewedTransactions ? (reviewedTransactions - humanOverrides) / reviewedTransactions : null;
  const humanOverrideRate = reviewedTransactions ? humanOverrides / reviewedTransactions : null;
  const straightThroughProcessingRate = cleanTransactions / totalTransactions;
  const manualReviewReductionRate = 1 - pendingRequiredReviews / totalTransactions;
  const anomalyCount = anomalies.length;
  const manualTimeMinutes = totalTransactions * metricAssumptions.manualBaselineMinutesPerTransaction;
  const aiAssistedTimeMinutes =
    cleanTransactions * metricAssumptions.quickScanMinutesPerCleanTransaction +
    pendingRequiredReviews * metricAssumptions.detailedReviewMinutesPerReviewTransaction +
    anomalyCount * metricAssumptions.anomalyResolutionMinutesPerAnomaly;
  const estimatedTimeSavedMinutes = Math.max(0, manualTimeMinutes - aiAssistedTimeMinutes);
  const estimatedTimeSavedPercent = manualTimeMinutes > 0 ? estimatedTimeSavedMinutes / manualTimeMinutes : null;
  const estimatedLaborCostSavedSgd = (estimatedTimeSavedMinutes / 60) * metricAssumptions.accountantHourlyCostSgd;

  const transactionDataLoadedScore = 1;
  const classificationCompletedScore = classifiedTransactions / totalTransactions;
  const anomalyResolutionScore = totalHighSeverity ? resolvedHighSeverity / totalHighSeverity : 1;
  const humanReviewScore = reviewRequiredTransactions ? reviewedTransactions / reviewRequiredTransactions : 1;
  const f5ValidationScore = f5ValidationPassed ? 1 : 0;
  const auditCompletenessScore = auditCompletenessRate ?? 0;
  const approvalReadinessScore = Math.round(
    100 *
      (transactionDataLoadedScore * 0.15 +
        classificationCompletedScore * 0.2 +
        anomalyResolutionScore * 0.25 +
        humanReviewScore * 0.2 +
        f5ValidationScore * 0.1 +
        auditCompletenessScore * 0.1)
  );

  return {
    periodId: period.id,
    totalTransactions,
    approvalReadinessScore,
    approvalReadinessStatus: getReadinessStatus(approvalReadinessScore, period),
    complianceBlockerCount,
    aiHumanAgreementRate,
    humanOverrideRate,
    straightThroughProcessingRate,
    manualReviewReductionRate,
    estimatedTimeSavedMinutes,
    estimatedTimeSavedPercent,
    estimatedLaborCostSavedSgd,
    auditCompletenessRate,
    assumptions: metricAssumptions,
    inputs: {
      classifiedTransactions,
      reviewRequiredTransactions,
      completedRequiredReviews: reviewedTransactions,
      reviewedTransactions,
      humanOverrides,
      cleanTransactions,
      unresolvedHighSeverityAnomalies: openHighSeverity,
      criticalValidationErrors: 0,
      failedF5ValidationChecks,
      missingFinalApprovalConfirmation,
      requiredAuditEvents: expectedAuditEvents.length,
      loggedRequiredAuditEvents,
      f5ValidationPassed
    }
  };
}

function buildExpectedAuditEvents(args: {
  totalTransactions: number;
  reviewRequiredTransactions: number;
  humanOverrides: number;
  hasSummary: boolean;
  f5Reviewed: boolean;
  approved: boolean;
}) {
  const events = ["FILING_PERIOD_CREATED"];
  if (args.totalTransactions > 0) {
    events.push("FILE_UPLOADED", "CLASSIFICATIONS_GENERATED", "EXCEPTIONS_GENERATED");
  }
  if (args.reviewRequiredTransactions > 0) events.push("TRANSACTION_REVIEWED_BY_HUMAN");
  if (args.humanOverrides > 0) events.push("OVERRIDE_APPLIED");
  if (args.hasSummary) events.push("GST_F5_RECALCULATED");
  if (args.f5Reviewed) events.push("GST_F5_REVIEWED_LOCALLY");
  if (args.approved) events.push("FINAL_APPROVAL_COMPLETED");
  if (args.approved) events.push("EXPORT_GENERATED");
  return events;
}

function hasAuditEvent(audit: AuditLogItem[], expectedAction: string) {
  if (expectedAction === "GST_F5_REVIEWED_LOCALLY") {
    return audit.some((event) => event.action.includes("GST_F5") || event.action.includes("F5"));
  }
  return audit.some((event) => event.action === expectedAction);
}

function nearlyEqual(left: number, right: number) {
  return Math.abs(left - right) < 0.01;
}
