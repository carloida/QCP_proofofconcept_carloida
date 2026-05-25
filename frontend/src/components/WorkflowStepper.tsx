import { WorkflowStep } from "../api";

const tone = {
  "Not Started": "border-slate-200 bg-slate-50 text-slate-500",
  "In Progress": "border-[#F69D39]/40 bg-[#F69D39]/10 text-[#9A4F10]",
  "AI Completed": "border-[#15803D]/30 bg-[#EAF7EE] text-[#166534]",
  "Needs Human Review": "border-[#E0C375]/80 bg-[#FFF7DC] text-[#765719]",
  Approved: "border-[#15803D]/30 bg-[#EAF7EE] text-[#166534]",
  Blocked: "border-[#D92243]/35 bg-[#D92243]/10 text-risk"
};

function isDone(status: WorkflowStep["status"]) {
  return status === "Approved" || status === "AI Completed";
}

function stepCardClass(active: boolean, done: boolean) {
  if (active) {
    return "border-[#1F2A44] bg-[#1F2A44] text-white shadow-[0_12px_28px_rgba(31,42,68,0.18)]";
  }
  if (done) {
    return "border-[#15803D]/35 bg-[#F0FDF4] text-[#14532D] hover:bg-[#DCFCE7]";
  }
  return "border-line bg-white text-ink hover:bg-warm";
}

export default function WorkflowStepper({
  steps,
  activeStepId,
  onSelect,
  getActionLabel
}: {
  steps: WorkflowStep[];
  activeStepId: number;
  onSelect: (stepId: number) => void;
  getActionLabel?: (step: WorkflowStep) => string;
}) {
  const activeIndex = steps.findIndex((step) => step.id === activeStepId);
  const progress = steps.length ? `${Math.max(activeIndex + 1, 1)} of ${steps.length}` : "0 of 0";

  return (
    <aside className="panel sticky top-5 flex max-h-[calc(100vh-2.5rem)] flex-col overflow-hidden p-3">
      <div className="border-b border-line pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#9A4F10]">Navigation</p>
            <h2 className="mt-1 text-base font-semibold text-ink">Work Area Steps</h2>
          </div>
          <span className="rounded-md border border-line bg-slate-50 px-2 py-1 text-xs font-semibold text-muted">{progress}</span>
        </div>
      </div>

      <div className="mt-3 grid flex-1 content-start gap-2 overflow-y-auto pr-1">
        {steps.map((step) => {
          const active = step.id === activeStepId;
          const done = isDone(step.status);
          return (
            <button
              key={step.id}
              className={`group rounded-md border p-2.5 text-left transition ${stepCardClass(active, done)}`}
              onClick={() => onSelect(step.id)}
            >
              <div className="flex items-start gap-2.5">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                  active ? "bg-white text-[#1F2A44]" : done ? "bg-[#BBF7D0] text-[#14532D]" : "bg-warm text-muted group-hover:bg-white"
                }`}>
                  {done ? "✓" : step.id}
                </span>
                <div className="min-w-0">
                  <p className={`line-clamp-2 text-sm font-semibold leading-5 ${active ? "text-white" : done ? "text-[#14532D]" : "text-ink"}`}>Step {step.id}: {step.title}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[0.68rem] font-semibold ${active ? "border-white/30 bg-white/12 text-white" : tone[step.status]}`}>{step.status}</span>
                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[0.68rem] font-semibold ${
                      active ? "border-white/30 bg-white text-[#1F2A44]" : done ? "border-[#15803D]/30 bg-white/70 text-[#14532D]" : "border-line bg-white text-ink"
                    }`}>
                      {getActionLabel?.(step) ?? "Open"}
                    </span>
                  </div>
                  {active && <p className="mt-2 line-clamp-3 text-xs leading-5 text-white/78">{step.summary}</p>}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-3 border-t border-line pt-3">
        <p className="text-xs leading-5 text-muted">Steps stay pinned while the workspace scrolls.</p>
      </div>
    </aside>
  );
}
