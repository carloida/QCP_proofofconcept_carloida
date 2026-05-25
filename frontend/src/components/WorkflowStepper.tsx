import { WorkflowStep } from "../api";

const tone = {
  "Not Started": "border-slate-200 bg-slate-50 text-slate-500",
  "In Progress": "border-[#F69D39]/40 bg-[#F69D39]/10 text-[#9A4F10]",
  "AI Completed": "border-[#E0C375]/50 bg-[#FFF9EE] text-[#6F5D24]",
  "Needs Human Review": "border-[#E0C375]/80 bg-[#FFF7DC] text-[#765719]",
  Approved: "border-[#E0C375]/60 bg-[#FFF9EE] text-[#6F5D24]",
  Blocked: "border-[#D92243]/35 bg-[#D92243]/10 text-risk"
};

export default function WorkflowStepper({
  steps,
  activeStepId,
  onSelect
}: {
  steps: WorkflowStep[];
  activeStepId: number;
  onSelect: (stepId: number) => void;
}) {
  return (
    <aside className="panel sticky top-4 h-fit p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9A4F10]">Navigation</p>
      <h2 className="mt-2 text-lg font-semibold text-ink">Work Area Steps</h2>
      <p className="mt-2 text-xs leading-5 text-muted">Click a step here to change the active workspace in the main panel.</p>
      <div className="mt-4 grid gap-3">
        {steps.map((step) => {
          const active = step.id === activeStepId;
          return (
            <button
              key={step.id}
              className={`rounded-md border p-3 text-left transition ${
                active
                  ? "border-[#1F2A44] bg-[#1F2A44] text-white shadow-[0_14px_32px_rgba(31,42,68,0.22)]"
                  : "border-line bg-white text-ink hover:bg-warm"
              }`}
              onClick={() => onSelect(step.id)}
            >
              <div className="flex items-start gap-3">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${active ? "bg-white text-[#1F2A44]" : "bg-warm text-muted"}`}>
                  {step.id}
                </span>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${active ? "text-white" : "text-ink"}`}>Step {step.id}: {step.title}</p>
                  <span className={`mt-2 inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${active ? "border-white/30 bg-white/12 text-white" : tone[step.status]}`}>{step.status}</span>
                  {active && <span className="ml-2 inline-flex rounded-md border border-white/30 bg-white px-2 py-1 text-xs font-semibold text-[#1F2A44]">Open now</span>}
                  <p className={`mt-2 text-xs leading-5 ${active ? "text-white/78" : "text-slate-500"}`}>{step.summary}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
