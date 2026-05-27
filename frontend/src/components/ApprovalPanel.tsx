import { FormEvent, useEffect, useRef, useState } from "react";
import { FilingPeriod, GstF5Summary } from "../api";
import WorkspaceCard from "./WorkspaceCard";

const confirmation =
  "I confirm that the GST F5 values have been reviewed by a human accountant and are ready for manual submission via IRAS myTax Portal. This prototype does not submit directly to IRAS.";

export default function ApprovalPanel({
  period,
  summary,
  f5Reviewed,
  focusAction,
  onFocusHandled,
  onReviewF5,
  onApprove
}: {
  period: FilingPeriod | null;
  summary: GstF5Summary | null;
  f5Reviewed: boolean;
  focusAction?: "review-f5" | "final-approval" | null;
  onFocusHandled?: () => void;
  onReviewF5: () => void;
  onApprove: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const blocked = !summary?.approval_ready || !f5Reviewed || period?.status === "APPROVED";
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!focusAction) return;
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (focusAction === "final-approval" && !blocked) {
      setOpen(true);
    }
    const timer = window.setTimeout(() => onFocusHandled?.(), 1800);
    return () => window.clearTimeout(timer);
  }, [blocked, focusAction, onFocusHandled]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!checked) return;
    await onApprove();
    setOpen(false);
    setChecked(false);
  }

  return (
    <WorkspaceCard
      ref={panelRef}
      badge="Human Approval Required"
      badgeClass="badge-blocked"
      title="Human Review and Final Approval"
      description="Human accountant approval is required before manual submission. This prototype does not submit to IRAS."
      focused={Boolean(focusAction)}
      status={<span className={`rounded-md border px-3 py-2 text-sm font-semibold ${blocked ? "border-[#D92243]/30 bg-[#D92243]/10 text-risk" : "border-[#E0C375]/70 bg-[#FFF9EE] text-[#6F5D24]"}`}>{blocked ? "Approval blocked" : "Ready for approval"}</span>}
      actions={
        <>
          <button
            className={`button-secondary ${focusAction === "review-f5" ? "ring-2 ring-[#F69D39]/60 ring-offset-2" : ""}`}
            disabled={!summary || f5Reviewed}
            onClick={onReviewF5}
          >
            Mark F5 boxes reviewed
          </button>
          <button
            className={`button-primary ${focusAction === "final-approval" ? "ring-2 ring-[#F69D39]/60 ring-offset-2" : ""}`}
            disabled={blocked}
            onClick={() => setOpen(true)}
          >
            Final approval
          </button>
        </>
      }
    >
      {blocked && period?.status !== "APPROVED" && (
        <p className="rounded-md border border-[#D92243]/30 bg-[#D92243]/10 p-3 text-sm text-risk">
          Cannot approve until GST F5 boxes are reviewed, high-severity anomalies are cleared, and required transaction reviews are completed.
        </p>
      )}
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4">
          <form className="panel w-full max-w-2xl p-5" onSubmit={submit}>
            <h3 className="text-lg font-semibold text-ink">Final approval confirmation</h3>
            <p className="mt-3 rounded-md bg-slate-50 p-4 text-sm leading-6 text-slate-700">{confirmation}</p>
            <label className="mt-4 flex gap-3 text-sm text-slate-700">
              <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
              I understand this is a human-reviewed filing package for manual IRAS submission.
            </label>
            <div className="mt-5 flex justify-end gap-3">
              <button className="button-secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
              <button className="button-primary" disabled={!checked} type="submit">Confirm final approval</button>
            </div>
          </form>
        </div>
      )}
    </WorkspaceCard>
  );
}
