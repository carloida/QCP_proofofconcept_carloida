import { useState } from "react";
import { AiStatus, AiUsageSummary } from "../api";
import AgentModeBadge from "./AgentModeBadge";
import AiUsageDetails from "./AiUsageDetails";

function formatAgentName(name: string) {
  return name.replaceAll("_", " ");
}

function formatCost(value?: number | null, currency = "USD") {
  if (value === null || value === undefined) return "Cost estimate unavailable";
  return `${currency} ${value.toFixed(4)}`;
}

export default function AiAgentRuntimeCard({
  status,
  usage,
  disabled,
  loadingAgent,
  error,
  onRunIngestionQuality,
  onRunClassification
}: {
  status: AiStatus | null;
  usage: AiUsageSummary | null;
  disabled: boolean;
  loadingAgent: string | null;
  error: string;
  onRunIngestionQuality: () => void;
  onRunClassification: () => void;
}) {
  const [pendingRun, setPendingRun] = useState<"ingestion" | "classification" | null>(null);
  const statusLabel =
    !status ? "Unavailable" : status.status === "enabled" ? "Enabled" : status.status === "disabled" ? "Disabled" : "Not configured";
  const usageSummary = usage?.summary;
  const lastRun = usageSummary?.last_run;
  const realAiEnabled = status?.status === "enabled";
  const activeAgents = realAiEnabled ? status.enabled_agents.length : 0;
  const deterministicCount = status?.deterministic_modules.length ?? 6;
  const tokenUseActive = loadingAgent !== null;
  const pendingRunUsesTokens = Boolean(pendingRun && realAiEnabled);

  function confirmRun(agent: "ingestion" | "classification") {
    setPendingRun(null);
    if (agent === "ingestion") {
      onRunIngestionQuality();
      return;
    }
    onRunClassification();
  }

  return (
    <section className={`rounded-md border bg-white p-3 transition ${tokenUseActive ? "border-[#F69D39] shadow-[0_0_0_3px_rgba(246,157,57,0.16)]" : "border-line"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">AI Agent Runtime</p>
          <h3 className="mt-1 text-sm font-semibold text-ink">{activeAgents} AI-enabled agents active</h3>
        </div>
        <AgentModeBadge mode={realAiEnabled ? "real-ai" : "not-configured"} label={statusLabel} />
      </div>

      {!realAiEnabled && (
        <p className="mt-3 rounded-md border border-line bg-slate-50 p-2 text-xs leading-5 text-slate-600">
          AI API key is not configured. The prototype is running in deterministic fallback mode.
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-md border border-[#D92243]/30 bg-[#D92243]/10 p-2 text-xs leading-5 text-risk">
          {error}
        </p>
      )}
      {tokenUseActive && (
        <div className="mt-3 rounded-md border border-[#F69D39]/40 bg-[#FFF5E5] p-2">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#F69D39]" />
            <p className="text-xs font-semibold text-[#9A4F10]">AI request running. Tokens are being used.</p>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-600">Token totals and cost estimate will update after the backend records the completed request.</p>
        </div>
      )}

      <div className="mt-3 grid gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Real AI-enabled agents when configured</p>
        <div className="flex flex-wrap gap-2">
          <AgentModeBadge mode="real-ai" />
          <span className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-ink">Ingestion & Data Quality</span>
          <span className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-ink">GST Treatment Classification</span>
        </div>
        <p className="text-xs leading-5 text-slate-500">
          {deterministicCount} deterministic controls cover evidence matching, reconciliation, F5 computation, workflow orchestration, audit trail, and export.
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className={`rounded-md border p-2 transition ${tokenUseActive ? "border-[#F69D39]/45 bg-[#FFF5E5]" : "border-line bg-slate-50"}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Tokens</p>
          <p className="mt-1 font-semibold text-ink">{(usageSummary?.total_tokens ?? 0).toLocaleString()}</p>
        </div>
        <div className="rounded-md border border-line bg-slate-50 p-2">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Estimated cost</p>
          <p className="mt-1 text-xs font-semibold text-ink">
            {usageSummary?.estimated_cost_sgd !== null && usageSummary?.estimated_cost_sgd !== undefined
              ? formatCost(usageSummary.estimated_cost_sgd, "SGD")
              : formatCost(usageSummary?.estimated_cost_usd, "USD")}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-md border border-line bg-slate-50 p-2">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Last AI run</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          {lastRun
            ? `${formatAgentName(lastRun.agent_name)} - ${lastRun.status}${lastRun.fallback_used ? " - fallback used" : ""} - ${lastRun.total_tokens.toLocaleString()} tokens`
            : "No AI run recorded for this period."}
        </p>
      </div>

      <div className="mt-3 grid gap-2">
        <button className="button-secondary w-full text-xs" disabled={disabled || loadingAgent !== null} onClick={() => setPendingRun("ingestion")}>
          {loadingAgent === "ingestion" ? "Running quality review..." : "Run ingestion quality review"}
        </button>
        <button className="button-primary w-full text-xs" disabled={disabled || loadingAgent !== null} onClick={() => setPendingRun("classification")}>
          {loadingAgent === "classification" ? "Running GST classification..." : "Run AI GST classification"}
        </button>
      </div>

      {pendingRun && (
        <div className="mt-3 rounded-md border border-[#F69D39]/45 bg-[#FFF9EE] p-3">
          <p className="text-sm font-semibold text-ink">
            {pendingRunUsesTokens ? "This action will use AI tokens" : "This action will run in fallback mode"}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {pendingRunUsesTokens
              ? `The backend will send parsed transaction fields to the configured OpenAI model for ${pendingRun === "ingestion" ? "ingestion data quality review" : "GST treatment recommendations"}. No API key is sent to the browser. Human review remains required for uncertain or risky outputs.`
              : "No OpenAI API key is configured for the backend, so this will use deterministic fallback logic and should not consume AI tokens."}
          </p>
          <div className="mt-3 flex gap-2">
            <button className="button-primary flex-1 text-xs" onClick={() => confirmRun(pendingRun)}>
              {pendingRunUsesTokens ? "Continue and use tokens" : "Continue with fallback"}
            </button>
            <button className="button-secondary flex-1 text-xs" onClick={() => setPendingRun(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-3">
        <AiUsageDetails events={usage?.events ?? []} />
      </div>
    </section>
  );
}
