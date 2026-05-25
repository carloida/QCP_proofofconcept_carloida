import { useEffect, useRef } from "react";
import { api } from "../api";

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
    <section
      ref={panelRef}
      className={`panel p-5 transition ${focused ? "ring-2 ring-[#F69D39]/60 ring-offset-2 ring-offset-warm" : ""}`}
    >
      <h2 className="text-lg font-semibold text-ink">Export Center</h2>
      <div className="mt-4 grid gap-2">
        {exports.map(([label, file]) => (
          <a key={file} className="button-secondary text-center" href={api.exportUrl(periodId, file)}>
            {label}
          </a>
        ))}
      </div>
    </section>
  );
}
