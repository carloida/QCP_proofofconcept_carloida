import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { deriveWorkflow, readiness, selectCurrentStep } from "./workflow";

type AppData = {
  periods: FilingPeriod[];
  activePeriod: FilingPeriod | null;
  transactions: Transaction[];
  exceptions: ExceptionItem[];
  summary: GstF5Summary | null;
  audit: AuditLogItem[];
};

type GuidedAction =
  | "create-period"
  | "upload-source"
  | "confirm-readiness"
  | "resolve-exception"
  | "review-transaction"
  | "review-f5"
  | "final-approval"
  | "export";

export default function App() {
  const [data, setData] = useState<AppData>({
    periods: [],
    activePeriod: null,
    transactions: [],
    exceptions: [],
    summary: null,
    audit: []
  });
  const [activeStepId, setActiveStepId] = useState(1);
  const [f5Reviewed, setF5Reviewed] = useState(false);
  const [ingestionConfirmations, setIngestionConfirmations] = useState({
    reportingQuarter: false,
    gstRegistered: false,
    sourceReady: false
  });
  const [localAudit, setLocalAudit] = useState<AuditLogItem[]>([]);
  const [activeSourceSummary, setActiveSourceSummary] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Start by creating a filing period, then upload your GST transaction CSV, Excel, or structured PDF file.");
  const [focusExceptionId, setFocusExceptionId] = useState<number | null>(null);
  const [focusTransactionId, setFocusTransactionId] = useState<number | null>(null);
  const [guidedAction, setGuidedAction] = useState<GuidedAction | null>("create-period");
  const workspaceRef = useRef<HTMLElement | null>(null);

  const refresh = useCallback(async (periodId?: number) => {
    setLoading(true);
    try {
      const periods = await api.listPeriods();
      const selected = periodId
        ? periods.find((period) => period.id === periodId) ?? periods[0] ?? null
        : periods.find((period) => period.id === data.activePeriod?.id) ?? periods[0] ?? null;
      if (!selected) {
        setData({
          periods,
          activePeriod: null,
          transactions: [],
          exceptions: [],
          summary: null,
          audit: []
        });
        setIngestionConfirmations({ reportingQuarter: false, gstRegistered: false, sourceReady: false });
        setActiveSourceSummary([]);
        setMessage("No filing period exists yet. Create one to begin.");
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
        periods: [],
        activePeriod: null,
        transactions: [],
        exceptions: [],
        summary: null,
        audit: []
      });
      setIngestionConfirmations({ reportingQuarter: false, gstRegistered: false, sourceReady: false });
      setActiveSourceSummary([]);
      setMessage(error instanceof Error ? `Backend unavailable: ${error.message}` : "Backend unavailable. Start the API before creating a filing period.");
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
  const humanReviewsRequired = data.summary?.needs_review_count ?? 0;
  const blockingIssues = highSeverityAnomalies;
  const filingReadiness = readiness(data.activePeriod, steps, data.summary);
  const openExceptions = data.exceptions.filter((item) => (item.status ?? "Open") === "Open");
  const firstOpenException = openExceptions.find((item) => item.severity === "HIGH") ?? openExceptions[0];
  const firstReviewTransaction = data.transactions.find((tx) => tx.review_status === "NEEDS_REVIEW" || tx.gst_treatment === "REVIEW_REQUIRED" || tx.classification_confidence < 0.7);
  const workflowApproved = data.activePeriod?.status === "APPROVED";
  const setupMode = !data.activePeriod;
  const hasGuidedRequiredAction = Boolean(
    workflowApproved ||
      !data.activePeriod ||
      !data.transactions.length ||
      !ingestionReady ||
      firstOpenException ||
      firstReviewTransaction ||
      (data.summary && !f5Reviewed) ||
      data.summary?.approval_ready
  );

  function requiredActionLabel() {
    if (workflowApproved) return "Open export center";
    if (!data.activePeriod) return "Create filing period";
    if (!data.transactions.length) return "Upload transaction file";
    if (!ingestionReady) return "Confirm ingestion readiness";
    if (firstOpenException) return "Resolve blocking issue";
    if (firstReviewTransaction) return "Review transaction";
    if (data.summary && !f5Reviewed) return "Review F5 boxes";
    if (data.summary?.approval_ready) return "Open final approval";
    return "Go to required action";
  }

  function scrollWorkspaceIntoView() {
    window.setTimeout(() => {
      workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function guideTo(stepId: number, options: { exceptionId?: number; transactionId?: number; action?: GuidedAction } = {}) {
    setActiveStepId(stepId);
    setFocusExceptionId(options.exceptionId ?? null);
    setFocusTransactionId(options.transactionId ?? null);
    setGuidedAction(options.action ?? null);
    scrollWorkspaceIntoView();
  }

  function guideToRequiredAction() {
    if (workflowApproved) return guideTo(7, { action: "export" });
    if (!data.activePeriod) return guideTo(1, { action: "create-period" });
    if (!data.transactions.length) return guideTo(1, { action: "upload-source" });
    if (!ingestionReady) return guideTo(1, { action: "confirm-readiness" });
    if (firstOpenException) {
      guideTo(4, { exceptionId: firstOpenException.id, action: "resolve-exception" });
      return;
    }
    if (firstReviewTransaction) {
      guideTo(3, { transactionId: firstReviewTransaction.id, action: "review-transaction" });
      return;
    }
    if (data.summary && !f5Reviewed) {
      guideTo(6, { action: "review-f5" });
      return;
    }
    if (data.summary?.approval_ready) {
      guideTo(6, { action: "final-approval" });
      return;
    }
    guideTo(data.summary ? 5 : 1);
  }

  function handleStepAction(stepId: number) {
    if (workflowApproved) {
      return guideTo(stepId === 7 ? 7 : stepId, { action: stepId === 7 ? "export" : undefined });
    }
    if (stepId === 1) {
      if (!data.activePeriod) return guideTo(1, { action: "create-period" });
      if (!data.transactions.length) return guideTo(1, { action: "upload-source" });
      if (!ingestionReady) return guideTo(1, { action: "confirm-readiness" });
      return guideTo(1);
    }
    if ((stepId === 2 || stepId === 4 || stepId === 6) && firstOpenException) {
      guideTo(4, { exceptionId: firstOpenException.id, action: "resolve-exception" });
      return;
    }
    if (stepId === 3 && firstReviewTransaction) {
      guideTo(3, { transactionId: firstReviewTransaction.id, action: "review-transaction" });
      return;
    }
    if (stepId === 5 && data.summary && !f5Reviewed) return guideTo(6, { action: "review-f5" });
    if (stepId === 6) {
      if (data.summary && !f5Reviewed) return guideTo(6, { action: "review-f5" });
      if (data.summary?.approval_ready) return guideTo(6, { action: "final-approval" });
    }
    if (stepId === 7) return guideTo(7, { action: "export" });
    guideTo(stepId);
  }

  function handleBoardStageAction(stageId: number) {
    if (workflowApproved) {
      if (stageId === 14) return guideTo(7, { action: "export" });
      if (stageId >= 12) return guideTo(6);
      if (stageId >= 10) return guideTo(5);
      if (stageId >= 7) return guideTo(3);
      if (stageId >= 4) return guideTo(4);
      return guideTo(1);
    }
    if (stageId <= 3) {
      if (!data.activePeriod) return guideTo(1, { action: "create-period" });
      if (!data.transactions.length) return guideTo(1, { action: "upload-source" });
      return guideTo(1, { action: ingestionReady ? undefined : "confirm-readiness" });
    }
    if ([4, 6, 8, 9, 12, 13].includes(stageId) && firstOpenException) {
      guideTo(4, { exceptionId: firstOpenException.id, action: "resolve-exception" });
      return;
    }
    if ([7, 9, 13].includes(stageId) && firstReviewTransaction) {
      guideTo(3, { transactionId: firstReviewTransaction.id, action: "review-transaction" });
      return;
    }
    if (stageId === 4) {
      guideTo(1, { action: "upload-source" });
      return;
    }
    if (stageId === 10) {
      guideTo(data.summary ? 5 : 3);
      return;
    }
    if (stageId === 11) {
      guideTo(data.summary ? 6 : 5, { action: data.summary && !f5Reviewed ? "review-f5" : undefined });
      return;
    }
    if (stageId === 12 || stageId === 13) {
      guideTo(6, { action: data.summary?.approval_ready && f5Reviewed ? "final-approval" : "review-f5" });
      return;
    }
    if (stageId === 14) {
      guideTo(7, { action: "export" });
      return;
    }
    guideToRequiredAction();
  }

  function stepActionLabel(step: { id: number; status: string }) {
    if (workflowApproved && step.id === 7) return "Export";
    if (workflowApproved || step.status === "Approved" || step.status === "AI Completed") return "View";
    if (step.id === 1 && !data.activePeriod) return "Create";
    if (step.id === 1 && !data.transactions.length) return "Upload";
    if (step.id === 1 && !ingestionReady) return "Confirm";
    if ((step.id === 2 || step.id === 4 || step.id === 6) && firstOpenException) return "Resolve";
    if (step.id === 3 && firstReviewTransaction) return "Review";
    if ((step.id === 5 || step.id === 6) && data.summary && !f5Reviewed) return "Review F5";
    if (step.id === 6 && data.summary?.approval_ready && f5Reviewed) return "Approve";
    if (step.id === 7) return "View";
    return "Open";
  }

  async function handleCreatePeriod(payload: { name: string; start_date: string; end_date: string }) {
    setLoading(true);
    try {
      const period = await api.createPeriod(payload);
      setMessage(`Created ${period.name}. Confirm GST registration status, then upload the quarterly CSV, Excel, or structured PDF file.`);
      setActiveStepId(1);
      setF5Reviewed(false);
      setGuidedAction("upload-source");
      await refresh(period.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create filing period.");
    } finally {
      setLoading(false);
    }
  }

  function handleStartNewQuarter() {
    setData((current) => ({
      periods: current.periods,
      activePeriod: null,
      transactions: [],
      exceptions: [],
      summary: null,
      audit: []
    }));
    setActiveStepId(1);
    setF5Reviewed(false);
    setIngestionConfirmations({ reportingQuarter: false, gstRegistered: false, sourceReady: false });
    setLocalAudit([]);
    setActiveSourceSummary([]);
    setFocusExceptionId(null);
    setFocusTransactionId(null);
    setGuidedAction("create-period");
    setMessage("Create a new reporting quarter to start from scratch. Existing quarters remain available in the selector.");
    scrollWorkspaceIntoView();
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
            onLocalAudit={appendLocalAudit}
            onSourceSummaryChange={setActiveSourceSummary}
            guidedAction={guidedAction === "create-period" || guidedAction === "upload-source" || guidedAction === "confirm-readiness" ? guidedAction : null}
            onGuidedActionHandled={() => setGuidedAction(null)}
          />
        );
      case 3:
        return (
          <TransactionTable
            transactions={data.transactions}
            anomalies={data.exceptions}
            audit={mergedAudit}
            focusTransactionId={focusTransactionId}
            onFocusHandled={() => {
              setFocusTransactionId(null);
              setGuidedAction(null);
            }}
            onRefresh={() => data.activePeriod && refresh(data.activePeriod.id)}
          />
        );
      case 4:
        return (
          <AnomalyQueue
            anomalies={data.exceptions}
            focusExceptionId={focusExceptionId}
            onFocusHandled={() => {
              setFocusExceptionId(null);
              setGuidedAction(null);
            }}
            onRefresh={() => data.activePeriod && refresh(data.activePeriod.id)}
          />
        );
      case 5:
        return <F5SummaryPanel summary={data.summary} />;
      case 6:
        return (
          <div className="grid gap-5">
            <ApprovalPanel
              period={data.activePeriod}
              summary={data.summary}
              f5Reviewed={f5Reviewed}
              focusAction={guidedAction === "review-f5" || guidedAction === "final-approval" ? guidedAction : null}
              onFocusHandled={() => setGuidedAction(null)}
              onReviewF5={() => setF5Reviewed(true)}
              onApprove={handleApprove}
            />
            <F5SummaryPanel summary={data.summary} />
          </div>
        );
      case 7:
        return (
          <div className="grid gap-5">
            <AuditTrail audit={mergedAudit} />
            {data.activePeriod && (
              <ExportCenter
                periodId={data.activePeriod.id}
                focused={guidedAction === "export"}
                onFocusHandled={() => setGuidedAction(null)}
              />
            )}
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <main className="min-h-screen bg-warm">
      <div className="mx-auto grid max-w-[1760px] gap-5 px-5 py-5">
        <header className="panel px-5 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9A4F10]">AI-assisted GST F5 preparation</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-normal text-ink">GST F5 Filing Workspace</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                Prepare a quarterly filing pack for manual IRAS myTax Portal submission.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select className="control min-w-72" value={data.activePeriod?.id ?? ""} onChange={(event) => {
                setGuidedAction(null);
                setF5Reviewed(false);
                setIngestionConfirmations({ reportingQuarter: false, gstRegistered: false, sourceReady: false });
                refresh(Number(event.target.value));
              }}>
                <option value="" disabled>{setupMode ? "Resume a saved quarter" : "Select reporting quarter"}</option>
                {data.periods.map((period) => (
                  <option key={period.id} value={period.id}>{period.name} - {period.status}</option>
                ))}
              </select>
              {!setupMode && (
                <button className="button-secondary" type="button" onClick={handleStartNewQuarter}>
                  New quarter
                </button>
              )}
              <span className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink">
                {data.activePeriod?.status ?? (loading ? "Syncing" : "New quarter setup")}
              </span>
            </div>
          </div>
        </header>

        {setupMode ? (
          <section ref={workspaceRef} className="mx-auto grid w-full max-w-3xl scroll-mt-5 gap-5">
            {renderStep()}
          </section>
        ) : (
          <>
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
            <div className="grid items-start gap-5 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
              <WorkflowStepper steps={steps} activeStepId={currentStep.id} onSelect={handleStepAction} getActionLabel={stepActionLabel} />
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
                  onStageAction={handleBoardStageAction}
                />
                <section ref={workspaceRef} className="panel scroll-mt-5 border-l-4 border-l-accent p-4">
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
              <CompliancePanel
                currentStep={currentStep}
                transactions={data.transactions}
                anomalies={data.exceptions}
                summary={data.summary}
                audit={mergedAudit}
                readiness={filingReadiness}
                activeSourceSummary={activeSourceSummary}
                onPrimaryAction={hasGuidedRequiredAction ? guideToRequiredAction : undefined}
                primaryActionLabel={requiredActionLabel()}
                onResolveException={(exceptionId) => guideTo(4, { exceptionId, action: "resolve-exception" })}
                onReviewTransaction={(transactionId) => guideTo(3, { transactionId, action: "review-transaction" })}
              />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
