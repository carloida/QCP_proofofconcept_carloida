import { WorkflowStep } from "../api";

const tone = {
  "Not Started": "border-slate-200 bg-slate-50 text-slate-500",
  "In Progress": "border-[#F69D39]/40 bg-[#F69D39]/10 text-[#9A4F10]",
  "AI Completed": "border-[#E0C375]/50 bg-[#FFF9EE] text-[#6F5D24]",
  "Needs Human Review": "border-[#F69D39]/40 bg-[#FFF5E5] text-[#9A4F10]",
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
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9A4F10]">Workflow</p>
      <h2 className="mt-2 text-lg font-semibold text-ink">Control Steps</h2>
      <div className="mt-4 grid gap-3">
        {steps.map((step) => (
          <button
            key={step.id}
            className={`rounded-md border p-3 text-left transition ${
              step.id === activeStepId ? "border-accent bg-surface shadow-sm" : "border-line bg-white hover:bg-warm"
            }`}
            onClick={() => onSelect(step.id)}
          >
            <div className="flex items-start gap-3">
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${step.id === activeStepId ? "bg-accent text-ink" : "bg-warm text-muted"}`}>
                {step.id}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">Step {step.id}: {step.title}</p>
                <span className={`mt-2 inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${tone[step.status]}`}>{step.status}</span>
                <p className="mt-2 text-xs leading-5 text-slate-500">{step.summary}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}
