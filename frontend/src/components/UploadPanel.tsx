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
              if (file) onUpload(file);
            }}
          />
          <p className="mt-2 text-xs text-slate-500">Upload CSV, Excel, or a structured PDF transaction export.</p>
        </div>
      )}
    </section>
  );
}
