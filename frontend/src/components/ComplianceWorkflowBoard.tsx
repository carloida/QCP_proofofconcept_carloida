import { useMemo, useState } from "react";
import { ExceptionItem, GstF5Summary, Transaction, WorkflowStep } from "../api";

type ProcessOwner =
  | "Human Accountant"
  | "System / Workflow Engine"
  | "Data Ingestion Hub"
  | "Supporting Evidence Layer"
  | "AI GST Classification Agent"
  | "Reconciliation & Anomaly Detection Agent"
  | "GST F5 Computation Agent"
  | "Filing Pack Generator"
  | "Manager / Final Approver"
  | "System Audit Trail";

type ResponsibilityCategory =
  | "AI Task"
  | "Human Review"
  | "Human Approval Required"
  | "System Audit"
  | "System Control"
  | "Data Ingestion"
  | "Evidence Validation"
  | "Computation";

type BoardStatus = "Not Started" | "In Progress" | "Completed" | "Blocked" | "Needs Review";
type OwnerFilter = "All" | "Human" | "AI Agents" | "System" | "Audit";
type ViewMode = "Overview" | "Detailed";

type BoardStage = {
  id: number;
  title: string;
  owner: ProcessOwner;
  category: ResponsibilityCategory;
  status: BoardStatus;
  description: string;
  requiredAction: string;
  auditEvents: string[];
};

function ownerFilter(owner: ProcessOwner): OwnerFilter {
  if (owner === "Human Accountant" || owner === "Manager / Final Approver") return "Human";
  if (owner.includes("Agent") || owner === "Filing Pack Generator") return "AI Agents";
  if (owner === "System Audit Trail") return "Audit";
  return "System";
}

function ownerBadge(owner: ProcessOwner) {
  if (owner === "Manager / Final Approver") return "badge-blocked";
  if (owner === "Human Accountant") return "badge-human";
  if (owner.includes("Agent") || owner === "Filing Pack Generator") return "badge-ai";
  if (owner === "System Audit Trail") return "badge-audit";
  return "badge-system";
}

function categoryBadge(category: ResponsibilityCategory) {
  if (category === "AI Task" || category === "Computation") return "badge-ai";
  if (category === "Human Review") return "badge-human";
  if (category === "Human Approval Required") return "badge-blocked";
  if (category === "System Audit") return "badge-audit";
  return "badge-system";
}

function filterClass(item: OwnerFilter, active: boolean) {
  if (!active) return "border-line bg-white text-muted hover:bg-warm";
  if (item === "AI Agents") return "border-[#3B82F6] bg-[#EAF3FF] text-[#1D4F8F]";
  if (item === "Human") return "border-[#E0C375] bg-[#FFF7DC] text-[#765719]";
  if (item === "Audit") return "border-[#B8C3D8] bg-[#F2F5FA] text-[#344054]";
  return "border-[#F69D39] bg-[#F69D39] text-ink";
}

function statusClass(status: BoardStatus) {
  switch (status) {
    case "Blocked":
      return "border-[#D92243]/40 bg-[#D92243]/10 text-risk";
    case "Needs Review":
      return "border-[#F69D39]/35 bg-[#FFF5E5] text-[#A4550F]";
    case "Completed":
      return "border-[#E0C375]/50 bg-[#FFF9EE] text-[#6F5D24]";
    case "In Progress":
      return "border-[#F69D39]/45 bg-[#F69D39]/10 text-[#9A4F10]";
    default:
      return "border-line bg-slate-50 text-muted";
  }
}

function statusDot(status: BoardStatus) {
  switch (status) {
    case "Blocked":
      return "bg-risk";
    case "Needs Review":
      return "bg-accent";
    case "Completed":
      return "bg-[#E0C375]";
    case "In Progress":
      return "bg-[#F69D39]";
    default:
      return "bg-slate-300";
  }
}

function phaseLabel(id: number) {
  if (id <= 3) return "Ingest";
  if (id <= 6) return "Validate";
  if (id <= 9) return "Review";
  if (id <= 12) return "Compute";
  return "Approve";
}

function buildStages(args: {
  currentStep: WorkflowStep;
  transactions: Transaction[];
  anomalies: ExceptionItem[];
  summary: GstF5Summary | null;
  readiness: string;
  sourceCount: number;
}): BoardStage[] {
  const openHigh = args.anomalies.filter((item) => item.severity === "HIGH" && (item.status ?? "Open") === "Open").length;
  const lowConfidence = args.transactions.filter((tx) => tx.classification_confidence < 0.7 || tx.review_status === "NEEDS_REVIEW").length;
  const hasData = args.transactions.length > 0;
  const hasSummary = Boolean(args.summary);
  const approved = args.readiness === "Approved for Manual Submission";
  const blockedByAnomaly = openHigh > 0;

  return [
    {
      id: 1,
      title: "Workflow Initialization",
      owner: "Human Accountant",
      category: "Human Review",
      status: "Completed",
      description: "Start quarterly GST F5 workflow, select Q2 2026, and confirm GST registration status.",
      requiredAction: "Confirm reporting quarter and GST registration before processing.",
      auditEvents: ["Workflow started", "Reporting quarter selected", "GST registration status confirmed"]
    },
    {
      id: 2,
      title: "Source Selection",
      owner: "Data Ingestion Hub",
      category: "Data Ingestion",
      status: args.sourceCount ? "Completed" : "In Progress",
      description: "Choose only the sources needed for this GST filing. You can add more data sources later.",
      requiredAction: "Select transaction sources; supporting evidence remains separate from transaction data.",
      auditEvents: ["Ingestion source selected", "Only active sources included in filing workflow"]
    },
    {
      id: 3,
      title: "Data Ingestion",
      owner: "Data Ingestion Hub",
      category: "Data Ingestion",
      status: hasData ? "Completed" : "In Progress",
      description: "Load CSV, sample data, database records, or accounting API transactions into the ingestion batch.",
      requiredAction: hasData ? "Review import warnings and source status." : "Load at least one transaction source before GST processing can continue.",
      auditEvents: ["Sample data load", "Column mapping", "Database preview", "API sync"]
    },
    {
      id: 4,
      title: "Evidence Upload and Matching",
      owner: "Supporting Evidence Layer",
      category: "Evidence Validation",
      status: "Needs Review",
      description: "Upload tax invoices, export evidence, import permits, receipts, and credit notes; link them to transactions.",
      requiredAction: "Supporting evidence improves validation but does not replace transaction data.",
      auditEvents: ["Evidence uploaded", "Evidence linked", "Missing or unlinked evidence logged"]
    },
    {
      id: 5,
      title: "Workflow Gating",
      owner: "System / Workflow Engine",
      category: "System Control",
      status: hasData ? "Completed" : "Blocked",
      description: "Check that transaction data, reporting quarter, GST registration status, and ingestion quality gates are ready.",
      requiredAction: hasData ? "Continue to standardization." : "Transaction data is required before GST processing can continue.",
      auditEvents: ["Workflow state initialized", "Filing readiness set", "Gate checks evaluated"]
    },
    {
      id: 6,
      title: "Standardization and Validation",
      owner: "System / Workflow Engine",
      category: "System Control",
      status: hasData ? (args.anomalies.length ? "Needs Review" : "Completed") : "Not Started",
      description: "Consolidate active source records into the canonical GST transaction schema and validate required fields.",
      requiredAction: "Human accountant reviews validation errors, mapping issues, duplicates, and source inconsistencies.",
      auditEvents: ["Canonical schema created", "Validation issues routed", "Duplicate checks completed"]
    },
    {
      id: 7,
      title: "AI GST Classification",
      owner: "AI GST Classification Agent",
      category: "AI Task",
      status: hasData ? (lowConfidence ? "Needs Review" : "Completed") : "Not Started",
      description: "AI recommends GST treatment, confidence score, rule explanation, evidence status, and human review priority.",
      requiredAction: "AI has completed initial classification. Human review is required for 6 transactions.",
      auditEvents: ["AI classified transactions", "Low confidence items marked for review"]
    },
    {
      id: 8,
      title: "Reconciliation and Anomaly Detection",
      owner: "Reconciliation & Anomaly Detection Agent",
      category: "AI Task",
      status: blockedByAnomaly ? "Blocked" : args.anomalies.length ? "Needs Review" : hasData ? "Completed" : "Not Started",
      description: "Detect GST rate mismatches, duplicate invoices, missing evidence, FX gaps, out-of-period items, and Box 5/Box 7 inconsistencies.",
      requiredAction: "F5 computation is blocked until unresolved high-severity anomalies are cleared.",
      auditEvents: ["High-severity anomaly detected", "Box consistency checks completed"]
    },
    {
      id: 9,
      title: "Human Review and Override",
      owner: "Human Accountant",
      category: "Human Review",
      status: lowConfidence || args.anomalies.length ? "Needs Review" : hasData ? "Completed" : "Not Started",
      description: "Inspect transaction details, approve or override AI recommendations, resolve anomalies, and record mandatory comments.",
      requiredAction: "Review AI explanation, confidence score, evidence status, and override reason where needed.",
      auditEvents: ["Transaction reviewed by human", "Human override recorded", "Anomaly resolution logged"]
    },
    {
      id: 10,
      title: "GST F5 Computation",
      owner: "GST F5 Computation Agent",
      category: "Computation",
      status: blockedByAnomaly ? "Blocked" : hasSummary ? "Completed" : "Not Started",
      description: "Compute Box 1 to Box 8 in SGD using reviewed GST treatments and actual tracked tax amounts.",
      requiredAction: "Box 4 must equal Box 1 + Box 2 + Box 3. Box 8 must equal Box 6 - Box 7.",
      auditEvents: ["F5 boxes computed", "Source logic and transaction counts attached"]
    },
    {
      id: 11,
      title: "Accountant F5 Review",
      owner: "Human Accountant",
      category: "Human Review",
      status: hasSummary ? "Needs Review" : "Not Started",
      description: "Review GST F5 computation summary, each box drilldown, unresolved warnings, and filing pack eligibility.",
      requiredAction: "Confirm F5 computation before generating the filing pack.",
      auditEvents: ["F5 summary opened", "F5 box drilldown reviewed"]
    },
    {
      id: 12,
      title: "Filing Pack Generation",
      owner: "Filing Pack Generator",
      category: "AI Task",
      status: hasSummary && !blockedByAnomaly ? "In Progress" : "Blocked",
      description: "Generate GST F5 summary, transaction listing, anomaly report, evidence traceability report, and audit trail export.",
      requiredAction: "Prepared for manual submission via IRAS myTax Portal. This prototype does not submit directly to IRAS.",
      auditEvents: ["Filing pack generated", "Export files prepared for manual submission"]
    },
    {
      id: 13,
      title: "Manager Final Approval",
      owner: "Manager / Final Approver",
      category: "Human Approval Required",
      status: approved ? "Completed" : blockedByAnomaly ? "Blocked" : "Needs Review",
      description: "Manager reviews filing pack, accountant confirmations, and unresolved warnings before approving or returning for revision.",
      requiredAction: "Manager final approval required before the workflow is approved for manual submission.",
      auditEvents: ["Manager approval pending", "Final approval confirmation captured"]
    },
    {
      id: 14,
      title: "Export and Manual Submission",
      owner: "System Audit Trail",
      category: "System Audit",
      status: approved ? "Completed" : "Not Started",
      description: "Lock approved workflow version, enable filing pack download, and log export or later manual submission record.",
      requiredAction: "Download the filing pack and manually submit through IRAS myTax Portal.",
      auditEvents: ["Approved version locked", "Export downloaded", "Manual submission record uploaded later"]
    }
  ];
}

export default function ComplianceWorkflowBoard({
  currentStep,
  transactions,
  anomalies,
  summary,
  readiness,
  activeSourceCount
}: {
  currentStep: WorkflowStep;
  transactions: Transaction[];
  anomalies: ExceptionItem[];
  summary: GstF5Summary | null;
  readiness: string;
  activeSourceCount: number;
}) {
  const [filter, setFilter] = useState<OwnerFilter>("All");
  const [viewMode, setViewMode] = useState<ViewMode>("Overview");
  const stages = useMemo(
    () => buildStages({ currentStep, transactions, anomalies, summary, readiness, sourceCount: activeSourceCount }),
    [currentStep, transactions, anomalies, summary, readiness, activeSourceCount]
  );
  const firstActionStage = stages.find((stage) => stage.status === "Blocked" || stage.status === "Needs Review") ?? stages[0];
  const [selectedId, setSelectedId] = useState(firstActionStage.id);
  const selected = stages.find((stage) => stage.id === selectedId) ?? firstActionStage;
  const visibleStages = stages.filter((stage) => filter === "All" || ownerFilter(stage.owner) === filter);
  const blockers = stages.filter((stage) => stage.status === "Blocked").length;
  const humanStages = stages.filter((stage) => stage.category.includes("Human") && stage.status !== "Completed").length;

  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-line bg-surface p-4">
        <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9A4F10]">Human-in-the-loop compliance workflow</p>
            <h2 className="mt-2 text-lg font-semibold text-ink">GST Workflow Control Board</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">
              Overview only: click a row to inspect ownership, required action, and audit events. Use the left Work Area Navigation to open the actual module below.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["All", "Human", "AI Agents", "System", "Audit"] as OwnerFilter[]).map((item) => (
              <button
                key={item}
                className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                  filterClass(item, filter === item)
                }`}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
            {(["Overview", "Detailed"] as ViewMode[]).map((item) => (
              <button
                key={item}
                className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                  viewMode === item ? "border-[#E0C375] bg-[#FFF5E5] text-ink" : "border-line bg-white text-muted hover:bg-warm"
                }`}
                onClick={() => setViewMode(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {[
            ["Current owner", currentStep.owner],
            ["Workflow blockers", String(blockers)],
            ["Human actions open", String(humanStages)],
            ["Filing readiness", readiness]
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border border-line bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
              <p className="mt-2 text-sm font-semibold text-ink">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="overflow-hidden rounded-md border border-line bg-white">
          <div className="grid grid-cols-[72px_minmax(0,1fr)_132px] gap-3 border-b border-line bg-[#FFFBF5] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted md:grid-cols-[84px_minmax(0,1fr)_180px_132px]">
            <span>Phase</span>
            <span>Workflow stage</span>
            <span className="hidden md:block">Owner</span>
            <span>Status</span>
          </div>
          {visibleStages.map((stage) => (
            <button
              key={stage.id}
              className={`relative grid w-full grid-cols-[72px_minmax(0,1fr)_132px] gap-3 border-b px-4 py-3 text-left transition last:border-b-0 hover:bg-[#FFF9EE] md:grid-cols-[84px_minmax(0,1fr)_180px_132px] ${
                selected.id === stage.id
                  ? "border-[#F69D39]/45 bg-[#FFF1D8] shadow-[inset_4px_0_0_#F69D39,0_6px_18px_rgba(31,42,68,0.06)]"
                  : stage.status === "Blocked"
                    ? "border-line bg-[#D92243]/[0.035]"
                    : "border-line bg-white"
              }`}
              onClick={() => setSelectedId(stage.id)}
            >
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#FFF5E5] text-xs font-bold text-ink">{stage.id}</span>
                <span className="hidden text-xs font-semibold text-muted sm:inline">{phaseLabel(stage.id)}</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot(stage.status)}`} />
                  <h3 className={`truncate text-sm text-ink ${selected.id === stage.id ? "font-bold" : "font-semibold"}`}>{stage.title}</h3>
                </div>
                <p className="mt-1 truncate text-xs text-muted">{stage.category}</p>
                {viewMode === "Detailed" && <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted">{stage.description}</p>}
              </div>
              <div className="hidden min-w-0 md:block">
                <p className="truncate text-sm font-medium text-ink">{stage.owner}</p>
                <p className="mt-1 truncate text-xs text-muted">{ownerFilter(stage.owner)}</p>
              </div>
              <div className="flex items-start justify-end">
                <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${statusClass(stage.status)}`}>{stage.status}</span>
              </div>
            </button>
          ))}
        </div>

        <aside className="h-fit rounded-md border border-[#D98422]/45 bg-[#F4B15E] p-4 shadow-[0_18px_36px_rgba(154,79,16,0.16)] xl:sticky xl:top-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5E310A]">Selected stage</p>
          <h3 className="mt-2 text-lg font-semibold text-ink">{selected.id}. {selected.title}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={ownerBadge(selected.owner)}>{selected.owner}</span>
            <span className={categoryBadge(selected.category)}>{selected.category}</span>
            <span className="rounded-md border border-[#8B4A10]/25 bg-[#FFF5E5] px-2 py-1 text-xs font-semibold text-[#5E310A]">{selected.status}</span>
          </div>
          <p className="mt-4 text-sm leading-6 text-[#4C2A0B]">{selected.description}</p>
          <div className="mt-4 rounded-md border border-[#8B4A10]/20 bg-white/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5E310A]">Required action</p>
            <p className="mt-2 text-sm leading-6 text-ink">{selected.requiredAction}</p>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5E310A]">Related audit events</p>
            <div className="mt-2 grid gap-2">
              {selected.auditEvents.map((event) => (
                <p key={event} className="rounded-md border border-[#8B4A10]/15 bg-white/65 p-2 text-sm text-[#4C2A0B]">{event}</p>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
