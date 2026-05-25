import { FormEvent, useState } from "react";
import { FilingPeriod } from "../api";

export default function UploadPanel({
  activePeriod,
  onCreatePeriod,
  onUpload,
  compact = false
}: {
  activePeriod: FilingPeriod | null;
  onCreatePeriod: (payload: { name: string; start_date: string; end_date: string }) => void;
  onUpload: (file: File) => void;
  compact?: boolean;
}) {
  const [name, setName] = useState("GST F5 Q1 2026");
  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState("2026-03-31");

  function submitPeriod(event: FormEvent) {
    event.preventDefault();
    onCreatePeriod({ name, start_date: startDate, end_date: endDate });
  }

  return (
    <section className={compact ? "" : "panel p-5"}>
      {!compact && <h2 className="text-lg font-semibold text-ink">Quarter Setup</h2>}
      <form className="mt-4 grid gap-3" onSubmit={submitPeriod}>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Period name
          <input className="control" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Start
            <input className="control" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            End
            <input className="control" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
        </div>
        <button className="button-primary" type="submit">
          Create filing period
        </button>
      </form>

      <div className="mt-6 border-t border-line pt-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">CSV ingestion</h3>
        <p className="mt-2 text-sm text-slate-600">
          Active period: <span className="font-semibold text-ink">{activePeriod?.name ?? "none selected"}</span>
        </p>
        <input
          className="control mt-3 w-full"
          type="file"
          accept=".csv,.xlsx,.xls"
          disabled={!activePeriod}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload(file);
          }}
        />
        <p className="mt-2 text-xs text-slate-500">Sample file: backend/sample_data/sample_qcp_gst_transactions.csv</p>
      </div>
    </section>
  );
}
