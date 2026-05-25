import { GstF5Summary } from "../api";

const money = new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" });

const boxMeta = [
  ["box_1_standard_rated_supplies", "box_1", "Box 1", "Standard-rated supplies, excluding GST", "Sum net amount for standard-rated supplies. Standard-rated supplies are subject to 9% GST."],
  ["box_2_zero_rated_supplies", "box_2", "Box 2", "Zero-rated supplies", "Sum net amount for zero-rated supplies at 0%; export or international-services evidence should be checked."],
  ["box_3_exempt_supplies", "box_3", "Box 3", "Exempt supplies", "Sum exempt supplies such as financial services, digital payment tokens, residential property, and investment precious metals."],
  ["box_4_total_supplies", "box_4", "Box 4", "Total supplies", "Box 1 + Box 2 + Box 3. Out-of-scope supplies are excluded from GST F5 reporting."],
  ["box_5_taxable_purchases", "box_5", "Box 5", "Taxable purchases, excluding GST", "Sum taxable purchases by net amount. Box 5 is tracked separately from Box 7."],
  ["box_6_output_tax_due", "box_6", "Box 6", "Output tax due", "Uses actual tracked GST amount where available; rate mismatches are flagged separately."],
  ["box_7_input_tax_claimed", "box_7", "Box 7", "Input tax and refunds claimed", "Uses claimable input tax from valid taxable purchases, not Box 5 multiplied by 9%."],
  ["box_8_net_gst_payable", "box_8", "Box 8", "Net GST payable/refundable", "Box 6 minus Box 7."]
] as const;

export default function F5SummaryPanel({ summary }: { summary: GstF5Summary | null }) {
  return (
    <section className="panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="badge-ai">Computation</span>
          <h2 className="mt-3 text-lg font-semibold text-ink">GST F5 Computation</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Report values in Singapore dollars. Box 4 = Box 1 + Box 2 + Box 3. Box 8 = Box 6 - Box 7. Out-of-scope supplies are excluded from GST F5 reporting.
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        {summary ? (
          boxMeta.map(([field, countKey, box, label, logic]) => {
            const isBox8 = box === "Box 8";
            const isInvalid =
              (box === "Box 4" &&
                summary.box_4_total_supplies !==
                  summary.box_1_standard_rated_supplies + summary.box_2_zero_rated_supplies + summary.box_3_exempt_supplies) ||
              (box === "Box 8" && summary.box_8_net_gst_payable !== summary.box_6_output_tax_due - summary.box_7_input_tax_claimed);
            return (
            <article
              key={field}
              className={`rounded-md border p-4 ${
                isInvalid
                  ? "border-[#D92243]/40 bg-[#D92243]/10"
                  : isBox8
                    ? "border-[#F69D39] bg-[#FFF5E5] shadow-soft"
                    : "border-[#E0C375]/60 bg-[#FFF9EE]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{box}: {label}</p>
                  <p className={`mt-2 font-semibold text-ink ${isBox8 ? "text-3xl" : "text-2xl"}`}>{money.format(Number(summary[field]))}</p>
                </div>
                <button className="button-secondary px-2 py-1 text-xs">Drilldown</button>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-600">{logic}</p>
              <p className="mt-2 text-xs font-semibold text-slate-500">{summary.box_counts?.[countKey] ?? 0} included transactions</p>
              {isInvalid && <p className="mt-2 text-xs font-semibold text-risk">Computation relationship is invalid.</p>}
            </article>
          );
          })
        ) : (
          <p className="text-sm text-slate-500">Upload and classify transactions to compute GST F5 boxes.</p>
        )}
      </div>
    </section>
  );
}
