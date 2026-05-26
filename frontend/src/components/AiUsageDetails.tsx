import { AiUsageEvent } from "../api";
import AgentModeBadge from "./AgentModeBadge";

function formatAgentName(name: string) {
  return name.replaceAll("_", " ");
}

export default function AiUsageDetails({ events }: { events: AiUsageEvent[] }) {
  if (!events.length) {
    return <p className="text-xs leading-5 text-slate-500">No AI requests have been recorded for this period yet.</p>;
  }

  return (
    <details className="rounded-md border border-line bg-white p-3">
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Per-request usage</summary>
      <div className="mt-3 grid gap-2">
        {events.slice(0, 6).map((event) => (
          <div key={event.id} className="rounded-md border border-line bg-slate-50 p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold capitalize text-ink">{formatAgentName(event.agent_name)}</p>
              {event.fallback_used ? <AgentModeBadge mode="fallback" /> : <AgentModeBadge mode="real-ai" label={event.status} />}
            </div>
            <p className="mt-1 text-xs text-slate-600">
              {event.total_tokens.toLocaleString()} tokens · {event.latency_ms} ms · {new Date(event.created_at).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </details>
  );
}
