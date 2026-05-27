import { useEffect, useRef } from "react";
import { api } from "../api";
import WorkspaceCard from "./WorkspaceCard";

export default function ExportCenter({
  periodId,
  focused,
  onFocusHandled
}: {
  periodId: number;
  focused?: boolean;
  onFocusHandled?: () => void;
}) {
  const panelRef = useRef<HTMLElement | null>(null);
  const exports = [
    ["GST F5 summary JSON", "gst-f5.json"],
    ["Reviewed transactions CSV", "transactions.csv"],
    ["Reconciliation exceptions CSV", "exceptions.csv"],
    ["Audit trail CSV", "audit.csv"]
  ] as const;

  useEffect(() => {
    if (!focused) return;
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = window.setTimeout(() => onFocusHandled?.(), 1800);
    return () => window.clearTimeout(timer);
  }, [focused, onFocusHandled]);

  return (
    <WorkspaceCard
      ref={panelRef}
      badge="System Audit"
      badgeClass="badge-audit"
      title="Export Center"
      description="Download the filing-ready materials for manual submission via IRAS myTax Portal."
      status={<span className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink">Manual submission pack</span>}
      focused={focused}
    >
      <div className="grid gap-2 md:grid-cols-2">
        {exports.map(([label, file]) => (
          <a key={file} className="button-secondary text-center" href={api.exportUrl(periodId, file)}>
            {label}
          </a>
        ))}
      </div>
    </WorkspaceCard>
  );
}
