import { AuditLogItem, ExceptionItem, FilingPeriod, GstF5Summary, Transaction, WorkflowStep } from "./api";

export function isComputedF5Summary(summary: GstF5Summary | null): summary is GstF5Summary {
  return Boolean(summary && summary.transaction_count > 0);
}

export function deriveWorkflow(
  period: FilingPeriod | null,
  transactions: Transaction[],
  anomalies: ExceptionItem[],
  summary: GstF5Summary | null,
  f5Reviewed: boolean,
  ingestionConfirmed = false
): WorkflowStep[] {
  const hasData = transactions.length > 0;
  const hasComputedSummary = hasData && isComputedF5Summary(summary);
  const lowConfidence = transactions.filter((tx) => tx.classification_confidence < 0.7 && tx.review_status !== "APPROVED").length;
  const needsReview = transactions.filter((tx) => tx.review_status === "NEEDS_REVIEW" || tx.gst_treatment === "REVIEW_REQUIRED").length;
  const reviewRequired = hasComputedSummary ? summary.needs_review_count : lowConfidence + needsReview;
  const openHigh = anomalies.filter((item) => item.severity === "HIGH" && (item.status ?? "Open") === "Open").length;
  const openAny = anomalies.filter((item) => (item.status ?? "Open") === "Open").length;
  const approved = period?.status === "APPROVED";

  return [
    {
      id: 1,
      title: "Data Ingestion Hub",
      status: approved ? "Approved" : hasData && ingestionConfirmed ? "Approved" : hasData ? "Needs Human Review" : period ? "In Progress" : "Not Started",
      owner: !period || (hasData && !ingestionConfirmed) ? "Human Accountant" : "AI Agent",
      summary: hasData
        ? `${transactions.length} transactions loaded. Confirm reporting quarter, GST registration, and source readiness before standardization.`
        : "Assemble transaction data and supporting evidence for the GST F5 workflow."
    },
    {
      id: 2,
      title: "Standardization and Validation",
      status: hasData ? (openAny ? "Needs Human Review" : "AI Completed") : "Not Started",
      owner: openAny ? "Human Accountant" : "AI Agent",
      summary: hasData ? "Fields standardized; validation exceptions routed to the anomaly queue." : "Waiting for source data."
    },
    {
      id: 3,
      title: "GST Treatment Classification",
      status: !hasData ? "Not Started" : lowConfidence || needsReview ? "Needs Human Review" : "AI Completed",
      owner: lowConfidence || needsReview ? "Human Accountant" : "AI Agent",
      summary:
        lowConfidence || needsReview
          ? `${reviewRequired} transactions require review before computation.`
          : "AI has completed initial classification."
    },
    {
      id: 4,
      title: "Reconciliation and Anomaly Detection",
      status: !hasData ? "Not Started" : openHigh ? "Blocked" : openAny ? "Needs Human Review" : "AI Completed",
      owner: openAny ? "Human Accountant" : "AI Agent",
      summary: openHigh ? "Filing is blocked until high-severity anomalies are resolved." : `${openAny} unresolved issue(s) remain.`
    },
    {
      id: 5,
      title: "GST F5 Computation",
      status: approved ? "Approved" : !hasComputedSummary ? "Not Started" : lowConfidence || needsReview ? "Blocked" : f5Reviewed ? "Approved" : "AI Completed",
      owner: f5Reviewed ? "Human Accountant" : "AI Agent",
      summary: hasComputedSummary ? "Box 1 to Box 8 and Box 13 computed from reviewed transaction treatments." : "Waiting for transaction data and reviewed treatments."
    },
    {
      id: 6,
      title: "Human Review and Approval",
      status: !hasComputedSummary ? "Not Started" : approved ? "Approved" : summary.approval_ready && f5Reviewed ? "Needs Human Review" : "Blocked",
      owner: approved ? "Manager" : "Human Accountant",
      summary: approved ? "Approved for manual submission via IRAS myTax Portal." : "Human accountant approval is required before manual submission."
    },
    {
      id: 7,
      title: "Audit Trail and Export",
      status: approved ? "Approved" : hasData ? "In Progress" : "Not Started",
      owner: "System",
      summary: "Audit trail and export records are maintained for every significant action."
    }
  ];
}

export function selectCurrentStep(steps: WorkflowStep[]) {
  return steps.find((step) => ["Blocked", "Needs Human Review", "In Progress"].includes(step.status)) ?? steps[0];
}

export function readiness(period: FilingPeriod | null, steps: WorkflowStep[], summary: GstF5Summary | null) {
  if (period?.status === "APPROVED") return "Approved for Manual Submission";
  if (isComputedF5Summary(summary) && summary.approval_ready) return "Ready for Approval";
  if (!period || steps.every((step) => step.status === "Not Started")) return "Not Ready";
  return "Review Required";
}

export function recentAudit(audit: AuditLogItem[]) {
  return [...audit].slice(-5).reverse();
}
