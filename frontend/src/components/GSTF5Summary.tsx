import { GstF5Summary } from "../api";

const money = new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" });

export default function GSTF5Summary({ summary, onApprove }: { summary: GstF5Summary | null; onApprove: () => void }) {
  const boxes = summary
    ? [
        ["Box 1", "Standard-rated supplies", summary.box_1_standard_rated_supplies],
        ["Box 2", "Zero-rated supplies", summary.box_2_zero_rated_supplies],
        ["Box 3", "Exempt supplies", summary.box_3_exempt_supplies],
        ["Box 4", "Total supplies", summary.box_4_total_supplies],
        ["Box 5", "Taxable purchases", summary.box_5_taxable_purchases],
        ["Box 6", "Output tax due", summary.box_6_output_tax_due],
        ["Box 7", "Input tax claimed", summary.box_7_input_tax_claimed],
        ["Box 8", "Net GST payable", summary.box_8_net_gst_payable]
      ]
    : [];

  return (
    <section className="panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">GST F5 Summary</h2>
          <p className="mt-1 text-sm text-slate-600">Core Box 1 to Box 8 values use transaction GST amounts, not blind rate multiplication.</p>
        </div>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{summary?.status ?? "DRAFT"}</span>
      </div>
      <div className="mt-4 grid gap-2">
        {boxes.map(([box, label, value]) => (
          <div key={String(box)} className="flex items-center justify-between border-b border-line py-2 last:border-b-0">
            <div>
              <p className="text-sm font-semibold text-ink">{box}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
            <p className="text-sm font-semibold text-ink">{money.format(Number(value))}</p>
          </div>
        ))}
        {!summary && <p className="text-sm text-slate-500">Upload transactions to compute the filing summary.</p>}
      </div>
      <button className="button-primary mt-5 w-full" disabled={!summary?.approval_ready || summary.status === "APPROVED"} onClick={onApprove}>
        Approve filing package
      </button>
      {summary && !summary.approval_ready && <p className="mt-2 text-xs text-risk">High severity exceptions must be cleared or acknowledged before approval.</p>}
    </section>
  );
}
