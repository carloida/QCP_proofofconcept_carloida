import { AuditLogItem } from "../api";
import WorkspaceCard from "./WorkspaceCard";

export default function AuditTrail({ audit }: { audit: AuditLogItem[] }) {
  return (
    <WorkspaceCard
      badge="System Audit"
      badgeClass="badge-audit"
      title="Audit Trail"
      description="Chronological evidence of ingestion, classification, human review, anomaly decisions, F5 computation, approval, and exports."
      status={<span className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink">{audit.length} events</span>}
      bodyClassName="p-0"
    >
      <div className="max-h-[560px] overflow-auto">
        <table className="min-w-[1060px] w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-[0.08em] text-slate-500">
            <tr>
              {["timestamp", "actor_type", "action", "affected_item", "old_value", "new_value", "reason", "step"].map((heading) => (
                <th key={heading} className="px-4 py-3">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {audit.map((item) => (
              <tr key={item.id} className="border-t border-line align-top">
                <td className="px-4 py-3">{new Date(item.created_at).toLocaleString()}</td>
                <td className="px-4 py-3">{item.actor_type ?? item.actor}</td>
                <td className="px-4 py-3 font-semibold text-ink">{item.action.replaceAll("_", " ")}</td>
                <td className="px-4 py-3">{item.affected_item ?? item.transaction_id ?? "filing_period"}</td>
                <td className="px-4 py-3">{item.old_value ?? "-"}</td>
                <td className="px-4 py-3">{item.new_value ?? "-"}</td>
                <td className="max-w-80 px-4 py-3 text-slate-600">{item.reason ?? item.details}</td>
                <td className="px-4 py-3">{item.step ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!audit.length && <p className="p-5 text-sm text-slate-500">No audit events yet.</p>}
      </div>
    </WorkspaceCard>
  );
}
