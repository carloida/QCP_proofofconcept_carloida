type AgentMode = "real-ai" | "deterministic" | "placeholder" | "fallback" | "not-configured";

const labels: Record<AgentMode, string> = {
  "real-ai": "Real AI Enabled",
  deterministic: "Deterministic Control",
  placeholder: "Placeholder",
  fallback: "Fallback Used",
  "not-configured": "AI Not Configured"
};

const classes: Record<AgentMode, string> = {
  "real-ai": "border-[#F69D39]/45 bg-[#FFF5E5] text-[#9A4F10]",
  deterministic: "border-[#B8C3D8] bg-[#F2F5FA] text-[#344054]",
  placeholder: "border-[#E0C375]/70 bg-[#FFF9EE] text-[#6F5D24]",
  fallback: "border-[#D92243]/35 bg-[#D92243]/10 text-risk",
  "not-configured": "border-line bg-slate-50 text-slate-600"
};

export default function AgentModeBadge({ mode, label }: { mode: AgentMode; label?: string }) {
  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${classes[mode]}`}>
      {label ?? labels[mode]}
    </span>
  );
}
