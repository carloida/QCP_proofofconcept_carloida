import { useCallback, useEffect, useMemo, useState } from "react";
import { api, AuditLogItem, ExceptionItem, FilingPeriod, GstF5Summary, Transaction } from "./api";
import AnomalyQueue from "./components/AnomalyQueue";
import ApprovalPanel from "./components/ApprovalPanel";
import AuditTrail from "./components/AuditTrail";
import CompliancePanel from "./components/CompliancePanel";
import ComplianceWorkflowBoard from "./components/ComplianceWorkflowBoard";
import DataIngestionHub from "./components/DataIngestionHub";
import ExportCenter from "./components/ExportCenter";
import F5SummaryPanel from "./components/F5SummaryPanel";
import ProcessFlowModal from "./components/ProcessFlowModal";
import StatusBanner from "./components/StatusBanner";
import TransactionTable from "./components/TransactionTable";
import WorkflowStepper from "./components/WorkflowStepper";
import { mockAudit, mockExceptions, mockPeriod, mockSummary, mockTransactions } from "./mockData";
import { deriveWorkflow, readiness, selectCurrentStep } from "./workflow";

type AppData = {
  periods: FilingPeriod[];
  activePeriod: FilingPeriod | null;
  transactions: Transaction[];
  exceptions: ExceptionItem[];
  summary: GstF5Summary | null;
  audit: AuditLogItem[];
};

function NavigationGuide() {
  return (
    <section className="panel p-4">
      <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr_1fr_1fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9A4F10]">How to navigate</p>
          <h2 className="mt-1 text-base font-semibold text-ink">Start with the left navigation, then review the center workspace.</h2>
        </div>
        {[
          ["1", "Work Area Steps", "Click a step on the left to open ingestion, transactions, anomalies, F5 computation, approval, or export."],
          ["2", "Control Board", "Use the center board to understand the end-to-end process and inspect ownership or required actions."],
          ["3", "Compliance Panel", "Use the right panel as your action queue for reviews, blockers, active sources, and audit events."]
        ].map(([number, title, body]) => (
          <div key={title} className="rounded-md border border-line bg-[#FFFBF5] p-3">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[#F69D39] text-xs font-bold text-ink">{number}</span>
              <p className="text-sm font-semibold text-ink">{title}</p>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function App() {
  const [data, setData] = useState<AppData>({
    periods: [mockPeriod],
    activePeriod: mockPeriod,
    transactions: mockTransactions,
    exceptions: mockExceptions,
    summary: mockSummary,
    audit: mockAudit
  });
  const [activeStepId, setActiveStepId] = useState(1);
  const [f5Reviewed, setF5Reviewed] = useState(false);
  const [ingestionConfirmations, setIngestionConfirmations] = useState({
    reportingQuarter: true,
    gstRegistered: true,
    sourceReady: true
  });
  const [localAudit, setLocalAudit] = useState<AuditLogItem[]>([]);
  const [activeSourceSummary, setActiveSourceSummary] = useState<string[]>(["Sample Dataset: Imported (128 records)", "Accounting API Connector: Imported (86 records)"]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Demo mode loaded for Q2 2026. AI has completed initial classification. Human review is required for 6 transactions.");

  const refresh = useCallback(async (periodId?: number) => {
    setLoading(true);
    try {
      const periods = await api.listPeriods();
      const selected = periodId
        ? periods.find((period) => period.id === periodId) ?? periods[0] ?? null
        : periods.find((period) => period.id === data.activePeriod?.id) ?? periods[0] ?? null;
      if (!selected) {
        setData({
          periods: [mockPeriod],
          activePeriod: mockPeriod,
          transactions: mockTransactions,
          exceptions: mockExceptions,
          summary: mockSummary,
          audit: mockAudit
        });
        setIngestionConfirmations({ reportingQuarter: true, gstRegistered: true, sourceReady: true });
        setActiveSourceSummary(["Sample Dataset: Imported (128 records)", "Accounting API Connector: Imported (86 records)"]);
        setMessage("Demo mode loaded for Q2 2026. AI has completed initial classification. Human review is required for 6 transactions.");
        return;
      }
      const [transactions, exceptions, summary, audit] = await Promise.all([
        api.transactions(selected.id),
        api.exceptions(selected.id),
        api.summary(selected.id),
        api.audit(selected.id)
      ]);
      setData({ periods, activePeriod: selected, transactions, exceptions, summary, audit });
    } catch (error) {
      setData({
        periods: [mockPeriod],
        activePeriod: mockPeriod,
        transactions: mockTransactions,
        exceptions: mockExceptions,
        summary: mockSummary,
        audit: mockAudit
      });
      setIngestionConfirmations({ reportingQuarter: true, gstRegistered: true, sourceReady: true });
      setActiveSourceSummary(["Sample Dataset: Imported (128 records)", "Accounting API Connector: Imported (86 records)"]);
      setMessage("Demo mode loaded because the backend API is unavailable. AI has completed initial classification. Human review is required for 6 transactions.");
    } finally {
      setLoading(false);
    }
  }, [data.activePeriod?.id]);

  useEffect(() => {
    refresh();
  }, []);

  const mergedAudit = useMemo(() => [...data.audit, ...localAudit].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()), [data.audit, localAudit]);
  const ingestionReady = ingestionConfirmations.reportingQuarter && ingestionConfirmations.gstRegistered && ingestionConfirmations.sourceReady;
  const steps = useMemo(() => deriveWorkflow(data.activePeriod, data.transactions, data.exceptions, data.summary, f5Reviewed, ingestionReady), [data, f5Reviewed, ingestionReady]);
  const currentStep = steps.find((step) => step.id === activeStepId) ?? selectCurrentStep(steps);
  const systemCurrentStep = selectCurrentStep(steps);
  const highSeverityAnomalies = data.exceptions.filter((item) => item.severity === "HIGH" && (item.status ?? "Open") === "Open").length;
  const humanReviewsRequired = data.summary?.needs_review_count ?? 6;
  const blockingIssues = highSeverityAnomalies;
  const filingReadiness = readiness(data.activePeriod, steps, data.summary);

  async function handleCreatePeriod(payload: { name: string; start_date: string; end_date: string }) {
    setLoading(true);
    try {
      const period = await api.createPeriod(payload);
      setMessage(`Created ${period.name}. Confirm GST registration status, then upload the quarterly CSV.`);
      setActiveStepId(1);
      await refresh(period.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create filing period.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(file: File) {
    if (!data.activePeriod) return;
    setLoading(true);
    try {
      const result = await api.upload(data.activePeriod.id, file);
      setMessage(`AI has completed initial classification. Human review is required for ${result.review_required} transactions.`);
      setActiveStepId(3);
      setF5Reviewed(false);
      await refresh(data.activePeriod.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadSample() {
    if (!data.activePeriod) {
      setMessage("Create a reporting quarter before loading sample data.");
      return;
    }
    setLoading(true);
    try {
      const result = await api.loadSample(data.activePeriod.id);
      appendLocalAudit("SAMPLE_DATASET_LOADED", "sample_dataset", `${result.inserted} transactions`, "Use sample data to demonstrate the full GST F5 workflow without uploading company files.");
      setMessage(`Sample GST quarter loaded with ${result.inserted} transactions and ${result.exceptions} validation/anomaly issues.`);
      setActiveStepId(1);
      setF5Reviewed(false);
      await refresh(data.activePeriod.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load sample dataset.");
    } finally {
      setLoading(false);
    }
  }

  function appendLocalAudit(action: string, affectedItem: string, newValue: string, reason: string) {
    setLocalAudit((events) => [
      ...events,
      {
        id: 100000 + events.length,
        filing_period_id: data.activePeriod?.id ?? 0,
        transaction_id: null,
        actor: "SYSTEM",
        actor_type: action.includes("CONFIRMED") || action.includes("UPLOADED") ? "Human" : "System",
        action,
        details: reason,
        affected_item: affectedItem,
        old_value: null,
        new_value: newValue,
        reason,
        step: "Step 1: Data Ingestion Hub",
        created_at: new Date().toISOString()
      }
    ]);
  }

  async function handleApprove() {
    if (!data.activePeriod) return;
    setLoading(true);
    try {
      await api.approve(data.activePeriod.id);
      setMessage("Approved for manual submission via IRAS myTax Portal. No automatic submission occurred.");
      setActiveStepId(7);
      await refresh(data.activePeriod.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Approval failed.");
    } finally {
      setLoading(false);
    }
  }

  function renderStep() {
    switch (currentStep.id) {
      case 1:
      case 2:
        return (
          <DataIngestionHub
            activePeriod={data.activePeriod}
            transactionCount={data.transactions.length}
            validationIssues={data.exceptions.filter((item) => (item.status ?? "Open") === "Open").length}
            confirmations={ingestionConfirmations}
            onConfirmationsChange={(next) => {
              setIngestionConfirmations(next);
              if (next.reportingQuarter && next.gstRegistered && next.sourceReady) {
                appendLocalAudit("INGESTION_READINESS_CONFIRMED_BY_HUMAN", "ingestion_hub", "ready_for_standardization", "Human accountant confirmed reporting quarter, GST registration, and source readiness.");
              }
            }}
            onCreatePeriod={handleCreatePeriod}
            onUpload={handleUpload}
            onLoadSample={handleLoadSample}
            onLocalAudit={appendLocalAudit}
            onSourceSummaryChange={setActiveSourceSummary}
          />
        );
      case 3:
        return <TransactionTable transactions={data.transactions} anomalies={data.exceptions} audit={mergedAudit} onRefresh={() => data.activePeriod && refresh(data.activePeriod.id)} />;
      case 4:
        return <AnomalyQueue anomalies={data.exceptions} onRefresh={() => data.activePeriod && refresh(data.activePeriod.id)} />;
      case 5:
        return <F5SummaryPanel summary={data.summary} />;
      case 6:
        return (
          <div className="grid gap-5">
            <ApprovalPanel period={data.activePeriod} summary={data.summary} f5Reviewed={f5Reviewed} onReviewF5={() => setF5Reviewed(true)} onApprove={handleApprove} />
            <F5SummaryPanel summary={data.summary} />
          </div>
        );
      case 7:
        return (
          <div className="grid gap-5">
            <AuditTrail audit={mergedAudit} />
            {data.activePeriod && <ExportCenter periodId={data.activePeriod.id} />}
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <main className="min-h-screen bg-warm">
      <div className="mx-auto grid max-w-[1760px] gap-5 px-5 py-5">
        <header className="panel overflow-hidden">
          <div className="flex flex-col justify-between gap-5 bg-gradient-to-r from-[#FFF5E5] via-white to-[#FFF9EE] p-6 xl:flex-row xl:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9A4F10]">AI-assisted GST F5 preparation</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-ink">AI Agent for GST F5 Filing Automation</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
              Human-in-the-loop GST compliance workflow for quarterly filing preparation. AI recommends, accountants review and override, and managers provide final approval.
            </p>
            <p className="mt-3 inline-flex rounded-md border border-[#E0C375]/70 bg-white px-3 py-2 text-sm font-semibold text-ink">
              Prepared for manual submission via IRAS myTax Portal. This prototype does not submit directly to IRAS.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select className="control min-w-72" value={data.activePeriod?.id ?? ""} onChange={(event) => refresh(Number(event.target.value))}>
              <option value="" disabled>Select reporting quarter</option>
              {data.periods.map((period) => (
                <option key={period.id} value={period.id}>{period.name} - {period.status}</option>
              ))}
            </select>
            <span className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink">{data.activePeriod?.status ?? (loading ? "Syncing" : "No period")}</span>
          </div>
          </div>
        </header>

        <StatusBanner
          period={data.activePeriod}
          currentStep={systemCurrentStep}
          blockingIssues={blockingIssues}
          readiness={filingReadiness}
          humanReviewsRequired={humanReviewsRequired}
          highSeverityAnomalies={highSeverityAnomalies}
          transactionCount={data.transactions.length}
        />
        <ProcessFlowModal />
        <NavigationGuide />

        <div className="grid gap-5 xl:grid-cols-[310px_minmax(0,1fr)_360px]">
          <WorkflowStepper steps={steps} activeStepId={currentStep.id} onSelect={setActiveStepId} />
          <section className="grid min-w-0 gap-5">
            <div className="panel p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge-ai">AI Task</span>
                <span className="badge-human">Human Review</span>
                <span className="badge-blocked">Human Approval Required</span>
                <span className="badge-audit">System Audit</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
            </div>
            <ComplianceWorkflowBoard
              currentStep={systemCurrentStep}
              transactions={data.transactions}
              anomalies={data.exceptions}
              summary={data.summary}
              readiness={filingReadiness}
              activeSourceCount={activeSourceSummary.length}
            />
            <section className="panel border-l-4 border-l-accent p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9A4F10]">Active workspace</p>
              <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-ink">Step {currentStep.id}: {currentStep.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-muted">{currentStep.summary}</p>
                </div>
                <span className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink">{currentStep.owner}</span>
              </div>
            </section>
            {renderStep()}
          </section>
          <CompliancePanel currentStep={currentStep} transactions={data.transactions} anomalies={data.exceptions} summary={data.summary} audit={mergedAudit} readiness={filingReadiness} activeSourceSummary={activeSourceSummary} />
        </div>
      </div>
    </main>
  );
}
