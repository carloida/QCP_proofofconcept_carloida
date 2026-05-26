import { FormEvent, useEffect, useRef, useState } from "react";
import { FilingPeriod } from "../api";

export default function UploadPanel({
  activePeriod,
  onCreatePeriod,
  onUpload,
  compact = false,
  showUpload = true,
  focusAction,
  onFocusHandled
}: {
  activePeriod: FilingPeriod | null;
  onCreatePeriod: (payload: { name: string; start_date: string; end_date: string }) => void;
  onUpload: (file: File) => void;
  compact?: boolean;
  showUpload?: boolean;
  focusAction?: "create-period" | "upload-source" | null;
  onFocusHandled?: () => void;
}) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const createRef = useRef<HTMLFormElement | null>(null);
  const uploadRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!focusAction) return;
    const target = focusAction === "create-period" ? createRef.current : uploadRef.current;
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = window.setTimeout(() => onFocusHandled?.(), 1800);
    return () => window.clearTimeout(timer);
  }, [focusAction, onFocusHandled]);

  function submitPeriod(event: FormEvent) {
    event.preventDefault();
    onCreatePeriod({ name, start_date: startDate, end_date: endDate });
  }

  function confirmUpload() {
    if (!pendingFile) return;
    onUpload(pendingFile);
    setPendingFile(null);
  }

  return (
    <section className={compact ? "" : "panel p-5"}>
      {!compact && <h2 className="text-lg font-semibold text-ink">Quarter Setup</h2>}
      <form
        ref={createRef}
        className={`mt-4 grid gap-3 rounded-md transition ${
          focusAction === "create-period" ? "ring-2 ring-[#F69D39]/60 ring-offset-4 ring-offset-white" : ""
        }`}
        onSubmit={submitPeriod}
      >
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Period name
          <input className="control" value={name} placeholder="e.g. GST F5 Q1 2026" required onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Start
            <input className="control" type="date" value={startDate} required onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            End
            <input className="control" type="date" value={endDate} required onChange={(event) => setEndDate(event.target.value)} />
          </label>
        </div>
        <button className="button-primary" type="submit">
          Create filing period
        </button>
      </form>

      {showUpload && (
        <div
          ref={uploadRef}
          className={`mt-6 border-t border-line pt-5 transition ${
            focusAction === "upload-source" ? "rounded-md ring-2 ring-[#F69D39]/60 ring-offset-4 ring-offset-white" : ""
          }`}
        >
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">CSV / Excel / PDF ingestion</h3>
          <p className="mt-2 text-sm text-slate-600">
            Active period: <span className="font-semibold text-ink">{activePeriod?.name ?? "none selected"}</span>
          </p>
          <input
            className="control mt-3 w-full"
            type="file"
            accept=".csv,.xlsx,.xls,.pdf"
            disabled={!activePeriod}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                setPendingFile(file);
                event.target.value = "";
              }
            }}
          />
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Upload parses CSV, Excel, or structured PDF files with deterministic rules. AI token use starts only when you run an AI Agent Runtime action.
          </p>
          {pendingFile && (
            <div className="mt-3 rounded-md border border-[#F69D39]/45 bg-[#FFF9EE] p-3">
              <p className="text-sm font-semibold text-ink">Upload does not use AI tokens</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                This will upload and parse <span className="font-semibold text-ink">{pendingFile.name}</span> using deterministic ingestion. AI quality review and AI GST classification are separate actions, and each will ask for confirmation before tokens are used.
              </p>
              <div className="mt-3 flex gap-2">
                <button className="button-primary flex-1 text-xs" type="button" onClick={confirmUpload}>
                  Upload file
                </button>
                <button className="button-secondary flex-1 text-xs" type="button" onClick={() => setPendingFile(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
