import { useState } from "react";

export default function ProcessFlowModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className="panel overflow-hidden">
        <button
          className="flex w-full flex-col gap-4 bg-[#1F2A44] p-5 text-left text-white transition hover:bg-[#263657] lg:flex-row lg:items-center lg:justify-between"
          onClick={() => setOpen(true)}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">System process flow</p>
            <h2 className="mt-2 text-xl font-semibold text-white">QCP AI Agent for End-to-End GST F5 Filing Automation</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
              Click to view the full swimlane process flow diagram for the GST F5 automation workflow.
            </p>
          </div>
          <span className="rounded-md border border-white/25 bg-white px-4 py-2 text-sm font-semibold text-[#1F2A44]">
            Open workflow image
          </span>
        </button>
      </section>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#1F2A44]/75 p-4">
          <div className="max-h-[94vh] w-full max-w-6xl overflow-hidden rounded-lg bg-white shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between gap-4 border-b border-line bg-white px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9A4F10]">Process flow image</p>
                <h2 className="mt-1 text-xl font-semibold text-ink">QCP AI Agent for End-to-End GST F5 Filing Automation</h2>
              </div>
              <button className="button-secondary" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>

            <div className="max-h-[82vh] overflow-auto bg-[#FFF5E5] p-6">
              <div className="mx-auto w-fit rounded-md border border-line bg-white p-4 shadow-panel">
                <img
                  src="/processflow_qcp.png"
                  alt="QCP AI Agent for End-to-End GST F5 Filing Automation swimlane process flow"
                  className="h-auto max-w-none"
                  style={{ width: 560 }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
