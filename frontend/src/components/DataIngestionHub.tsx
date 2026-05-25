import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  ColumnMapping,
  EvidenceDocument,
  FilingPeriod,
  IngestionBatch,
  IngestionSource,
  SourceRecordPreview
} from "../api";
import ResponsibilityMatrix from "./ResponsibilityMatrix";
import UploadPanel from "./UploadPanel";

type Confirmations = {
  reportingQuarter: boolean;
  gstRegistered: boolean;
  sourceReady: boolean;
};

type SourceId = "csv" | "sample" | "database" | "api" | "evidence";

type IngestionHubProps = {
  activePeriod: FilingPeriod | null;
  transactionCount: number;
  validationIssues: number;
  confirmations: Confirmations;
  onConfirmationsChange: (confirmations: Confirmations) => void;
  onCreatePeriod: (payload: { name: string; start_date: string; end_date: string }) => void;
  onUpload: (file: File) => void;
  onLoadSample: () => Promise<void>;
  onLocalAudit: (action: string, affectedItem: string, newValue: string, reason: string) => void;
  onSourceSummaryChange: (summary: string[]) => void;
};

const sourceCatalog: Array<{
  id: SourceId;
  title: string;
  description: string;
}> = [
  { id: "csv", title: "CSV / Excel Upload", description: "Use accounting exports from spreadsheets." },
  { id: "sample", title: "Sample Dataset", description: "Load demo transactions for prototype testing." },
  { id: "database", title: "Database Connector", description: "Preview read-only enterprise database ingestion." },
  { id: "api", title: "Accounting API Connector", description: "Simulate connection to Xero, QuickBooks, NetSuite, SAP, or Oracle." },
  { id: "evidence", title: "Supporting Evidence Upload", description: "Attach tax invoices, export evidence, import permits, and receipts." }
];

const transactionSourceIds: SourceId[] = ["csv", "sample", "database", "api"];

const defaultMappings: ColumnMapping[] = [
  { detectedColumn: "Invoice No.", canonicalField: "invoice_number" },
  { detectedColumn: "Customer", canonicalField: "customer_name" },
  { detectedColumn: "Supplier", canonicalField: "supplier_name" },
  { detectedColumn: "Tax Amount", canonicalField: "gst_amount_sgd" },
  { detectedColumn: "Net Amount", canonicalField: "net_amount_sgd" },
  { detectedColumn: "Total", canonicalField: "gross_amount_sgd" },
  { detectedColumn: "Posting Date", canonicalField: "posting_date" },
  { detectedColumn: "Currency", canonicalField: "currency" }
];

const previewRows: SourceRecordPreview[] = [
  { invoice_number: "S-1001", counterparty: "Marina Analytics Pte Ltd", transaction_type: "SALE", net_amount_sgd: 12000, gst_amount_sgd: 1080, validation_status: "ready" },
  { invoice_number: "EXP-9105", counterparty: "Seoul Electronics", transaction_type: "SALE", net_amount_sgd: 14400, gst_amount_sgd: 0, validation_status: "missing export evidence" },
  { invoice_number: "FX-9002", counterparty: "US SaaS Vendor", transaction_type: "PURCHASE", net_amount_sgd: 2000, gst_amount_sgd: 180, validation_status: "FX conversion required" }
];

const canonicalFields = [
  "transaction_id",
  "source_system",
  "source_record_id",
  "ingestion_batch_id",
  "document_id",
  "transaction_date",
  "posting_date",
  "invoice_number",
  "supplier_name",
  "customer_name",
  "supplier_gst_registered",
  "customer_country",
  "description",
  "transaction_type",
  "currency",
  "exchange_rate_to_sgd",
  "net_amount_sgd",
  "gst_amount_sgd",
  "gross_amount_sgd",
  "tax_code_from_source",
  "ai_gst_treatment",
  "confidence_score",
  "evidence_status",
  "approval_status"
];

export default function DataIngestionHub({
  activePeriod,
  transactionCount,
  validationIssues,
  confirmations,
  onConfirmationsChange,
  onCreatePeriod,
  onUpload,
  onLoadSample,
  onLocalAudit,
  onSourceSummaryChange
}: IngestionHubProps) {
  const [sources, setSources] = useState<IngestionSource[]>([
    { id: "csv", name: "CSV / Excel Upload", type: "CSV_EXCEL", status: "Not Connected", recordCount: 0, lastUpdated: "Not updated", owner: "Human" },
    { id: "sample", name: "Sample Dataset", type: "SAMPLE_DATASET", status: "Ready", recordCount: 0, lastUpdated: "Bundled sample", owner: "System" },
    { id: "database", name: "Database Connector", type: "DATABASE", status: "Not Connected", recordCount: 0, lastUpdated: "Not updated", owner: "System" },
    { id: "api", name: "Accounting API Connector", type: "ACCOUNTING_API", status: "Not Connected", recordCount: 0, lastUpdated: "Not updated", owner: "System" },
    { id: "evidence", name: "Supporting Evidence Upload", type: "SUPPORTING_EVIDENCE", status: "Not Connected", recordCount: 0, lastUpdated: "Not updated", owner: "Human" }
  ]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<SourceId[]>([]);
  const [draftSelectedSourceIds, setDraftSelectedSourceIds] = useState<SourceId[]>([]);
  const [addSourceOpen, setAddSourceOpen] = useState(false);
  const [showMapping, setShowMapping] = useState(false);
  const [showDbPreview, setShowDbPreview] = useState(false);
  const [dbConfigured, setDbConfigured] = useState(false);
  const [apiConfigured, setApiConfigured] = useState(false);
  const [apiLog, setApiLog] = useState<string[]>([]);
  const [evidenceDocs, setEvidenceDocs] = useState<EvidenceDocument[]>([]);

  useEffect(() => {
    if (transactionCount > 0 && !selectedSourceIds.some((id) => transactionSourceIds.includes(id))) {
      setSelectedSourceIds((current) => [...current, "sample"]);
      updateSource("sample", { status: "Imported", recordCount: transactionCount });
    }
  }, [transactionCount]);

  const activeSources = useMemo(
    () => sources.filter((source) => selectedSourceIds.includes(source.id as SourceId)),
    [sources, selectedSourceIds]
  );
  const transactionSources = activeSources.filter((source) => transactionSourceIds.includes(source.id as SourceId));
  const importedTransactionSources = transactionSources.filter((source) => source.recordCount > 0 && source.status === "Imported");
  const evidenceLoaded = selectedSourceIds.includes("evidence") ? evidenceDocs.length : 0;
  const sourcesRequiringReview = activeSources.filter((source) => source.status === "Needs Review" || source.status === "Failed").length;
  const criticalIngestionIssues = validationIssues;
  const hasTransactionSourceLoaded = importedTransactionSources.length > 0 || transactionCount > 0;
  const overallStatus =
    hasTransactionSourceLoaded && confirmations.reportingQuarter && confirmations.gstRegistered && criticalIngestionIssues === 0
      ? "Ready for standardization"
      : hasTransactionSourceLoaded
        ? "Ready for standardization with warnings"
        : "Choose a transaction source to begin";

  useEffect(() => {
    const summary = activeSources.map((source) => `${source.name}: ${source.status}${source.recordCount ? ` (${source.recordCount} records)` : ""}`);
    onSourceSummaryChange(summary);
  }, [activeSources, onSourceSummaryChange]);

  const pipelineRows: IngestionBatch[] = useMemo(
    () =>
      activeSources.map((source) => {
        if (source.id === "evidence") {
          return {
            batch_id: "EVIDENCE",
            source_id: "Supporting Evidence",
            raw_records: evidenceLoaded,
            standardized_records: evidenceDocs.filter((doc) => doc.linked_transaction_id !== "Unlinked").length,
            validation_status: `${evidenceDocs.filter((doc) => doc.evidence_status === "Unlinked").length} unlinked`
          };
        }
        if (source.id === "database" && showDbPreview && source.status !== "Imported") {
          return { batch_id: "DB", source_id: source.name, raw_records: source.recordCount, standardized_records: 0, validation_status: "preview only" };
        }
        if (source.id === "sample") {
          return { batch_id: "SAMPLE", source_id: source.name, raw_records: transactionCount, standardized_records: transactionCount, validation_status: transactionCount ? "ready" : "not loaded" };
        }
        return {
          batch_id: source.id.toUpperCase(),
          source_id: source.name,
          raw_records: source.recordCount,
          standardized_records: source.status === "Imported" ? Math.max(0, source.recordCount - (source.id === "csv" ? 2 : 0)) : 0,
          validation_status: source.status === "Imported" ? (source.id === "csv" ? "2 need review" : "ready") : source.status.toLowerCase()
        };
      }),
    [activeSources, evidenceLoaded, evidenceDocs, showDbPreview, transactionCount]
  );

  function updateSource(id: SourceId, patch: Partial<IngestionSource>) {
    setSources((current) =>
      current.map((source) => (source.id === id ? { ...source, ...patch, lastUpdated: new Date().toLocaleString() } : source))
    );
  }

  function selectSource(id: SourceId) {
    setSelectedSourceIds((current) => (current.includes(id) ? current : [...current, id]));
    const source = sources.find((item) => item.id === id);
    onLocalAudit(
      `${id === "database" ? "DATABASE_CONNECTOR" : id === "api" ? "ACCOUNTING_API" : id === "evidence" ? "SUPPORTING_EVIDENCE_SOURCE" : "INGESTION_SOURCE"}_SELECTED`,
      id,
      source?.name ?? id,
      "Choose only the sources needed for this GST filing."
    );
  }

  function removeSource(id: SourceId) {
    const source = sources.find((item) => item.id === id);
    if (source?.status === "Imported") {
      updateSource(id, { status: "Needs Review" });
      onLocalAudit("INGESTION_SOURCE_MARKED_INACTIVE", id, source.name, "Imported source retained for audit but marked for review.");
      return;
    }
    setSelectedSourceIds((current) => current.filter((sourceId) => sourceId !== id));
    onLocalAudit("INGESTION_SOURCE_REMOVED", id, source?.name ?? id, "Source removed before import.");
  }

  function continueWithSelected() {
    draftSelectedSourceIds.forEach(selectSource);
    setDraftSelectedSourceIds([]);
  }

  async function loadSample() {
    selectSource("sample");
    updateSource("sample", { status: "Processing" });
    await onLoadSample();
    updateSource("sample", { status: "Imported", recordCount: 56 });
  }

  return (
    <div className="grid gap-5">
      <IngestionReadinessSummary
        activePeriod={activePeriod}
        selectedCount={selectedSourceIds.length}
        importedCount={importedTransactionSources.length}
        transactionCount={transactionCount}
        evidenceLoaded={evidenceLoaded}
        sourcesRequiringReview={sourcesRequiringReview}
        criticalIngestionIssues={criticalIngestionIssues}
        overallStatus={overallStatus}
        confirmations={confirmations}
        onConfirmationsChange={onConfirmationsChange}
      />

      {!selectedSourceIds.length && (
        <EmptySourceState
          draftSelectedSourceIds={draftSelectedSourceIds}
          setDraftSelectedSourceIds={setDraftSelectedSourceIds}
          onContinue={continueWithSelected}
          onLoadSample={loadSample}
        />
      )}

      {!!selectedSourceIds.length && (
        <>
          <section className="panel p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">Active Sources</h2>
                <p className="mt-1 text-sm text-slate-600">Only active sources are included in this filing workflow. You can add more data sources later.</p>
              </div>
              <button className="button-secondary" onClick={() => setAddSourceOpen((value) => !value)}>
                Add another source
              </button>
            </div>
          </section>

          <div className="grid gap-5 2xl:grid-cols-2">
            {selectedSourceIds.includes("csv") && (
              <CSVExcelUploadCard
                activePeriod={activePeriod}
                source={sourceById(sources, "csv")}
                showMapping={showMapping}
                onRemove={() => removeSource("csv")}
                onToggleMapping={() => setShowMapping((value) => !value)}
                onCreatePeriod={onCreatePeriod}
                onUpload={(file) => {
                  updateSource("csv", { status: "Imported", recordCount: transactionCount || 47 });
                  onLocalAudit("CSV_UPLOADED", "csv_upload", file.name, "CSV or Excel source uploaded for GST processing.");
                  onUpload(file);
                }}
                onMappingSaved={() => onLocalAudit("COLUMN_MAPPING_SAVED", "canonical_schema", "8 mappings saved", "Map uploaded columns into canonical GST schema.")}
              />
            )}
            {selectedSourceIds.includes("sample") && (
              <SampleDatasetCard source={sourceById(sources, "sample")} onLoadSample={loadSample} onRemove={() => removeSource("sample")} />
            )}
            {selectedSourceIds.includes("database") && (
              <DatabaseConnectorCard
                source={sourceById(sources, "database")}
                configured={dbConfigured}
                showPreview={showDbPreview}
                onConfigure={() => setDbConfigured((value) => !value)}
                onRemove={() => removeSource("database")}
                onTest={() => {
                  updateSource("database", { status: "Ready", recordCount: 120 });
                  onLocalAudit("DATABASE_CONNECTION_TESTED", "database_connector", "successful", "Database connection tested successfully.");
                }}
                onPreview={() => {
                  setShowDbPreview(true);
                  updateSource("database", { status: "Ready", recordCount: 120 });
                  onLocalAudit("DATABASE_PREVIEW_GENERATED", "database_connector", "120 preview records", "Preview generated from read-only source tables.");
                }}
                onImport={() => {
                  updateSource("database", { status: "Imported", recordCount: 120 });
                  onLocalAudit("DATABASE_TABLES_IMPORTED", "database_connector", "sales, purchases, expenses, GL", "Selected tables imported into canonical staging.");
                }}
              />
            )}
            {selectedSourceIds.includes("api") && (
              <AccountingAPIConnectorCard
                source={sourceById(sources, "api")}
                configured={apiConfigured}
                apiLog={apiLog}
                onConfigure={() => setApiConfigured((value) => !value)}
                onRemove={() => removeSource("api")}
                onConnect={() => {
                  updateSource("api", { status: "Ready", recordCount: 0 });
                  setApiLog((log) => [`${new Date().toLocaleString()} - Xero connected`, ...log]);
                  onLocalAudit("ACCOUNTING_API_CONNECTED", "accounting_api", "Connected", "Simulated provider OAuth completed.");
                }}
                onSync={() => {
                  updateSource("api", { status: "Imported", recordCount: 86 });
                  setApiLog((log) => [`${new Date().toLocaleString()} - 86 transactions synced`, ...log]);
                  onLocalAudit("ACCOUNTING_API_SYNCED", "accounting_api", "86 records found", "Simulated transaction sync completed.");
                }}
                onDisconnect={() => {
                  updateSource("api", { status: "Not Connected", recordCount: 0 });
                  setApiLog((log) => [`${new Date().toLocaleString()} - disconnected`, ...log]);
                }}
              />
            )}
          </div>

          {selectedSourceIds.includes("evidence") && (
            <SupportingEvidenceCard
              source={sourceById(sources, "evidence")}
              documents={evidenceDocs}
              onRemove={() => removeSource("evidence")}
              onUploadEvidence={() => {
                const newDoc: EvidenceDocument = {
                  document_id: `DOC-${String(evidenceDocs.length + 1).padStart(3, "0")}`,
                  file_name: `receipt_${Date.now()}.pdf`,
                  document_type: "receipt",
                  linked_transaction_id: "Unlinked",
                  evidence_status: "Unlinked",
                  uploaded_at: new Date().toLocaleString(),
                  review_status: "Pending Review"
                };
                setEvidenceDocs((docs) => [...docs, newDoc]);
                updateSource("evidence", { status: "Needs Review", recordCount: evidenceDocs.length + 1 });
                onLocalAudit("EVIDENCE_UPLOADED", newDoc.document_id, newDoc.file_name, "Supporting evidence uploaded for review.");
              }}
              onLinkEvidence={(documentId) => {
                setEvidenceDocs((docs) => docs.map((doc) => (doc.document_id === documentId ? { ...doc, linked_transaction_id: "1", evidence_status: "Needs Review" } : doc)));
                onLocalAudit("EVIDENCE_LINKED_TO_TRANSACTION", documentId, "transaction:1", "Evidence linked by human accountant.");
              }}
              onOcr={(documentId) => onLocalAudit("OCR_EXTRACTION_COMPLETED", documentId, "invoice fields extracted", "Prototype OCR extraction simulated.")}
              onMarkValid={(documentId) => {
                setEvidenceDocs((docs) => docs.map((doc) => (doc.document_id === documentId ? { ...doc, evidence_status: "Valid", review_status: "Approved" } : doc)));
              }}
              onReject={(documentId) => {
                setEvidenceDocs((docs) => docs.map((doc) => (doc.document_id === documentId ? { ...doc, evidence_status: "Rejected", review_status: "Rejected" } : doc)));
              }}
            />
          )}

          {addSourceOpen && (
            <AddAnotherSourcePanel
              selectedSourceIds={selectedSourceIds}
              onAdd={(id) => {
                selectSource(id);
                setAddSourceOpen(false);
              }}
              onClose={() => setAddSourceOpen(false)}
            />
          )}
        </>
      )}

      {!!selectedSourceIds.length && <SourcePipelineStatus rows={pipelineRows} />}
      <CanonicalSchemaPanel />
      <ResponsibilityMatrix />
    </div>
  );
}

function sourceById(sources: IngestionSource[], id: SourceId) {
  return sources.find((source) => source.id === id)!;
}

function IngestionReadinessSummary({
  activePeriod,
  selectedCount,
  importedCount,
  transactionCount,
  evidenceLoaded,
  sourcesRequiringReview,
  criticalIngestionIssues,
  overallStatus,
  confirmations,
  onConfirmationsChange
}: {
  activePeriod: FilingPeriod | null;
  selectedCount: number;
  importedCount: number;
  transactionCount: number;
  evidenceLoaded: number;
  sourcesRequiringReview: number;
  criticalIngestionIssues: number;
  overallStatus: string;
  confirmations: Confirmations;
  onConfirmationsChange: (confirmations: Confirmations) => void;
}) {
  const primaryMetrics = [
    ["Transactions", String(transactionCount)],
    ["Active sources", `${importedCount}/${selectedCount}`],
    ["Critical issues", String(criticalIngestionIssues)],
    ["GST status", confirmations.gstRegistered ? "Confirmed" : "Pending"]
  ];
  const secondaryMetrics = [
    `Period: ${activePeriod ? `${activePeriod.start_date} to ${activePeriod.end_date}` : "Not created"}`,
    `Evidence: ${evidenceLoaded}`,
    `Sources needing review: ${sourcesRequiringReview}`
  ];

  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-line bg-[#FFFBF5] p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <span className="badge-system">Data Ingestion</span>
            <h2 className="mt-3 text-xl font-semibold text-ink">Step 1: Data Ingestion Hub</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Choose only the sources needed for this GST filing. Supporting evidence improves validation but does not replace transaction data.</p>
          </div>
          <span className="rounded-md border border-[#1F2A44]/15 bg-white px-3 py-2 text-sm font-semibold text-ink">{overallStatus}</span>
        </div>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div>
          <div className="grid gap-3 md:grid-cols-4">
            {primaryMetrics.map(([label, value]) => (
              <div key={label} className="rounded-md border border-line bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">{label}</p>
                <p className="mt-2 text-lg font-semibold text-ink">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {secondaryMetrics.map((item) => (
              <span key={item} className="rounded-md border border-line bg-slate-50 px-3 py-2 text-xs font-semibold text-muted">{item}</span>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-line bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Accountant confirmations</p>
          <div className="mt-3 grid gap-2">
            {[
              ["reportingQuarter", "Reporting quarter is correct"],
              ["gstRegistered", "Company is GST registered"],
              ["sourceReady", "Source data is ready"]
            ].map(([key, label]) => (
              <label key={key} className="flex items-start gap-3 rounded-md bg-[#FFFBF5] p-2 text-sm text-slate-700">
                <input
                  className="mt-1"
                  type="checkbox"
                  checked={confirmations[key as keyof Confirmations]}
                  onChange={(event) => onConfirmationsChange({ ...confirmations, [key]: event.target.checked })}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function EmptySourceState({
  draftSelectedSourceIds,
  setDraftSelectedSourceIds,
  onContinue,
  onLoadSample
}: {
  draftSelectedSourceIds: SourceId[];
  setDraftSelectedSourceIds: (ids: SourceId[]) => void;
  onContinue: () => void;
  onLoadSample: () => void;
}) {
  return (
    <section className="panel p-6">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-xl font-semibold text-ink">Choose how you want to ingest GST data</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Start with one or more sources. You can add more later.</p>
      </div>
      <SourceSelector selectedIds={draftSelectedSourceIds} onChange={setDraftSelectedSourceIds} />
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <button className="button-primary" onClick={onLoadSample}>Use Sample Dataset</button>
        <button className="button-secondary" disabled={!draftSelectedSourceIds.length} onClick={onContinue}>Continue with Selected Sources</button>
      </div>
    </section>
  );
}

function SourceSelector({ selectedIds, onChange }: { selectedIds: SourceId[]; onChange: (ids: SourceId[]) => void }) {
  function toggle(id: SourceId) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
  }

  return (
    <div className="mt-5 grid gap-3 lg:grid-cols-5">
      {sourceCatalog.map((source) => (
        <button
          key={source.id}
          className={`rounded-md border p-4 text-left transition ${selectedIds.includes(source.id) ? "border-accent bg-surface" : "border-line bg-white hover:bg-warm"}`}
          onClick={() => toggle(source.id)}
        >
          <div className="flex items-start gap-3">
            <input type="checkbox" checked={selectedIds.includes(source.id)} readOnly />
            <div>
              <p className="text-sm font-semibold text-ink">{source.title}</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">{source.description}</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function AddAnotherSourcePanel({ selectedSourceIds, onAdd, onClose }: { selectedSourceIds: SourceId[]; onAdd: (id: SourceId) => void; onClose: () => void }) {
  const availableSources = sourceCatalog.filter((source) => !selectedSourceIds.includes(source.id));
  return (
    <section className="panel p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Add another source</h2>
          <p className="mt-1 text-sm text-slate-600">Database and API connectors are available as enterprise ingestion options.</p>
        </div>
        <button className="button-secondary" onClick={onClose}>Close</button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {availableSources.map((source) => (
          <button key={source.id} className="rounded-md border border-line bg-white p-4 text-left hover:bg-slate-50" onClick={() => onAdd(source.id)}>
            <p className="text-sm font-semibold text-ink">{source.title}</p>
            <p className="mt-2 text-xs leading-5 text-slate-600">{source.description}</p>
          </button>
        ))}
        {!availableSources.length && <p className="text-sm text-slate-500">All ingestion sources are already active.</p>}
      </div>
    </section>
  );
}

function SourceShell({ source, onRemove, children }: { source: IngestionSource; onRemove: () => void; children: ReactNode }) {
  return (
    <section className="panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{source.owner}</span>
          <h3 className="mt-3 text-lg font-semibold text-ink">{source.name}</h3>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{source.type}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="rounded-md border border-line px-2 py-1 text-xs font-semibold text-ink">{source.status}</span>
          <button className="text-xs font-semibold text-slate-500 hover:text-risk" onClick={onRemove}>
            {source.status === "Imported" ? "Mark inactive" : "Remove source"}
          </button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <p className="text-slate-500">Record count <span className="font-semibold text-ink">{source.recordCount}</span></p>
        <p className="text-slate-500">Last updated <span className="font-semibold text-ink">{source.lastUpdated}</span></p>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function CSVExcelUploadCard(props: {
  activePeriod: FilingPeriod | null;
  source: IngestionSource;
  showMapping: boolean;
  onRemove: () => void;
  onToggleMapping: () => void;
  onCreatePeriod: IngestionHubProps["onCreatePeriod"];
  onUpload: (file: File) => void;
  onMappingSaved: () => void;
}) {
  return (
    <SourceShell source={props.source} onRemove={props.onRemove}>
      <p className="text-sm leading-6 text-slate-600">Accepted source types: sales invoices, purchase invoices, expense claims, GL extract. Map uploaded columns into the canonical GST schema before classification.</p>
      <div className="mt-4 rounded-md border border-line bg-slate-50 p-4">
        <UploadPanel activePeriod={props.activePeriod} onCreatePeriod={props.onCreatePeriod} onUpload={props.onUpload} compact />
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button className="button-secondary" onClick={props.onToggleMapping}>Column mapping view</button>
        <button className="button-secondary" onClick={props.onToggleMapping}>Preview records</button>
      </div>
      {props.showMapping && <ColumnMappingPanel onSave={props.onMappingSaved} />}
    </SourceShell>
  );
}

function ColumnMappingPanel({ onSave }: { onSave: () => void }) {
  return (
    <div className="mt-4 rounded-md border border-line bg-white p-4">
      <h4 className="text-sm font-semibold text-ink">Detected Column - Canonical Field</h4>
      <div className="mt-3 grid gap-2">
        {defaultMappings.map((mapping) => (
          <div key={mapping.detectedColumn} className="grid grid-cols-[1fr_1fr] gap-3 text-sm">
            <span className="rounded-md bg-slate-50 p-2 text-slate-700">{mapping.detectedColumn}</span>
            <span className="rounded-md bg-surface p-2 font-semibold text-[#9A4F10]">{mapping.canonicalField}</span>
          </div>
        ))}
      </div>
      <button className="button-primary mt-4" onClick={onSave}>Save column mapping</button>
    </div>
  );
}

function SampleDatasetCard({ source, onLoadSample, onRemove }: { source: IngestionSource; onLoadSample: () => void; onRemove: () => void }) {
  return (
    <SourceShell source={source} onRemove={onRemove}>
      <p className="text-sm leading-6 text-slate-600">Use sample data to demonstrate the full GST F5 workflow without uploading company files.</p>
      <button className="button-primary mt-4" onClick={onLoadSample}>Load Sample GST Quarter</button>
      <button className="button-secondary ml-3 mt-4" onClick={onLoadSample}>Reset Demo Data</button>
    </SourceShell>
  );
}

function DatabaseConnectorCard({ source, configured, showPreview, onConfigure, onRemove, onTest, onPreview, onImport }: { source: IngestionSource; configured: boolean; showPreview: boolean; onConfigure: () => void; onRemove: () => void; onTest: () => void; onPreview: () => void; onImport: () => void }) {
  return (
    <SourceShell source={source} onRemove={onRemove}>
      <p className="text-sm leading-6 text-slate-600">Database ingestion should use read-only access. The GST agent should not modify source accounting records.</p>
      <button className="button-secondary mt-4" onClick={onConfigure}>{configured ? "Hide connection setup" : "Configure"}</button>
      {configured && (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium text-slate-700">Database type<select className="control"><option>PostgreSQL</option><option>MySQL</option><option>SQL Server</option><option>Snowflake</option><option>BigQuery</option></select></label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">Host<input className="control" type="password" defaultValue="finance-db.company.internal" /></label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">Database name<input className="control" defaultValue="finance_prod" /></label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">Schema<input className="control" defaultValue="accounting" /></label>
          </div>
          <p className="mt-3 text-sm text-slate-600">Connection mode: <span className="font-semibold text-ink">Read-only</span></p>
          <p className="mt-2 text-sm text-slate-600">Tables: sales_invoices, purchase_invoices, expense_claims, vendors, customers, gl_entries</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="button-secondary" onClick={onTest}>Test Connection</button>
            <button className="button-secondary" onClick={onPreview}>Preview Data</button>
            <button className="button-primary" onClick={onImport}>Import Selected Tables</button>
          </div>
        </>
      )}
      {showPreview && <PreviewTable />}
    </SourceShell>
  );
}

function PreviewTable() {
  return (
    <div className="mt-4 rounded-md border border-line bg-white p-4">
      <h4 className="text-sm font-semibold text-ink">Preview Data</h4>
      <div className="mt-3 grid gap-2 text-sm">
        {previewRows.map((row) => <p key={row.invoice_number} className="rounded-md bg-slate-50 p-2">{row.invoice_number} - {row.counterparty} - {row.validation_status}</p>)}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 md:grid-cols-5">
        {["120 records found", "3 missing invoice numbers", "2 duplicate records", "9 foreign currency records", "4 out-of-period records"].map((item) => <span key={item} className="rounded-md bg-slate-50 p-2">{item}</span>)}
      </div>
    </div>
  );
}

function AccountingAPIConnectorCard({ source, configured, apiLog, onConfigure, onRemove, onConnect, onSync, onDisconnect }: { source: IngestionSource; configured: boolean; apiLog: string[]; onConfigure: () => void; onRemove: () => void; onConnect: () => void; onSync: () => void; onDisconnect: () => void }) {
  return (
    <SourceShell source={source} onRemove={onRemove}>
      <p className="text-sm leading-6 text-slate-600">Accounting API integrations are the preferred long-term ingestion method for cloud accounting systems.</p>
      <button className="button-secondary mt-4" onClick={onConfigure}>{configured ? "Hide provider setup" : "Configure"}</button>
      {configured && (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium text-slate-700">Provider<select className="control"><option>Xero</option><option>QuickBooks</option><option>NetSuite</option><option>SAP</option><option>Oracle</option></select></label>
            <p className="rounded-md border border-line bg-slate-50 p-3 text-sm">Auth status: <span className="font-semibold text-ink">{source.status === "Not Connected" ? "Disconnected" : "Connected"}</span></p>
          </div>
          <p className="mt-3 text-sm text-slate-600">Sync scope: sales invoices, bills, credit notes, expense claims, tax codes, contacts</p>
          <p className="mt-1 text-sm text-slate-600">Records found: <span className="font-semibold text-ink">{source.recordCount}</span></p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="button-secondary" onClick={onConnect}>Connect</button>
            <button className="button-primary" onClick={onSync}>Sync Transactions</button>
            <button className="button-secondary" onClick={() => undefined}>View Sync Log</button>
            <button className="button-secondary" onClick={onDisconnect}>Disconnect</button>
          </div>
        </>
      )}
      {!!apiLog.length && <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs text-slate-600">{apiLog.map((item) => <p key={item}>{item}</p>)}</div>}
    </SourceShell>
  );
}

function SupportingEvidenceCard({ source, documents, onRemove, onUploadEvidence, onLinkEvidence, onOcr, onMarkValid, onReject }: { source: IngestionSource; documents: EvidenceDocument[]; onRemove: () => void; onUploadEvidence: () => void; onLinkEvidence: (documentId: string) => void; onOcr: (documentId: string) => void; onMarkValid: (documentId: string) => void; onReject: (documentId: string) => void }) {
  return (
    <SourceShell source={{ ...source, recordCount: documents.length }} onRemove={onRemove}>
      <p className="text-sm leading-6 text-slate-600">Zero-rated supplies and input tax claims may require supporting evidence before they can be approved. Supporting evidence does not replace transaction data.</p>
      <button className="button-primary mt-4" onClick={onUploadEvidence}>Upload Evidence</button>
      <EvidenceTable documents={documents} onLinkEvidence={onLinkEvidence} onOcr={onOcr} onMarkValid={onMarkValid} onReject={onReject} />
    </SourceShell>
  );
}

function EvidenceTable({ documents, onLinkEvidence, onOcr, onMarkValid, onReject }: { documents: EvidenceDocument[]; onLinkEvidence: (documentId: string) => void; onOcr: (documentId: string) => void; onMarkValid: (documentId: string) => void; onReject: (documentId: string) => void }) {
  if (!documents.length) {
    return <p className="mt-4 rounded-md border border-line bg-slate-50 p-4 text-sm text-slate-600">No evidence documents uploaded yet.</p>;
  }
  return (
    <div className="mt-4 overflow-auto">
      <table className="min-w-[900px] w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-[0.08em] text-slate-500">
          <tr>{["document_id", "file_name", "document_type", "linked_transaction_id", "evidence_status", "uploaded_at", "review_status", "actions"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.document_id} className="border-t border-line">
              <td className="px-3 py-2">{doc.document_id}</td><td className="px-3 py-2">{doc.file_name}</td><td className="px-3 py-2">{doc.document_type}</td><td className="px-3 py-2">{doc.linked_transaction_id}</td><td className="px-3 py-2">{doc.evidence_status}</td><td className="px-3 py-2">{doc.uploaded_at}</td><td className="px-3 py-2">{doc.review_status}</td>
              <td className="px-3 py-2"><div className="flex gap-2"><button className="button-secondary px-2 py-1 text-xs" onClick={() => onLinkEvidence(doc.document_id)}>Link</button><button className="button-secondary px-2 py-1 text-xs" onClick={() => onOcr(doc.document_id)}>OCR</button><button className="button-secondary px-2 py-1 text-xs" onClick={() => onMarkValid(doc.document_id)}>Valid</button><button className="button-secondary px-2 py-1 text-xs" onClick={() => onReject(doc.document_id)}>Reject</button></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CanonicalSchemaPanel() {
  const [open, setOpen] = useState(false);
  return (
    <section className="panel p-5">
      <button className="flex w-full items-center justify-between text-left" onClick={() => setOpen((value) => !value)}>
        <div>
          <h3 className="text-lg font-semibold text-ink">Canonical GST Transaction Schema</h3>
          <p className="mt-1 text-sm text-slate-600">Regardless of source, every record is converted into one GST-ready schema before AI classification.</p>
        </div>
        <span className="button-secondary px-3 py-1">{open ? "Hide" : "Show"}</span>
      </button>
      {open && <div className="mt-4 flex flex-wrap gap-2">{canonicalFields.map((field) => <span key={field} className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{field}</span>)}</div>}
    </section>
  );
}

function SourcePipelineStatus({ rows }: { rows: IngestionBatch[] }) {
  return (
    <section className="panel p-5">
      <h3 className="text-lg font-semibold text-ink">Source-to-Pipeline Visibility</h3>
      <div className="mt-4 grid gap-2">
        {rows.map((row) => (
          <div key={row.batch_id} className="grid gap-2 rounded-md border border-line p-3 text-sm md:grid-cols-4">
            <span className="font-semibold text-ink">{row.source_id}</span>
            <span>{row.raw_records} raw records</span>
            <span>{row.standardized_records} standardized records</span>
            <span className="font-semibold text-slate-600">{row.validation_status}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
