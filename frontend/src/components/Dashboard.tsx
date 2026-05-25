import { ExceptionItem, GstF5Summary, Transaction } from "../api";

const money = new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" });

export default function Dashboard({
  summary,
  transactions,
  exceptions,
  message
}: {
  summary: GstF5Summary | null;
  transactions: Transaction[];
  exceptions: ExceptionItem[];
  message: string;
}) {
  const high = exceptions.filter((item) => item.severity === "HIGH").length;
  const needsReview = transactions.filter((item) => item.review_status === "NEEDS_REVIEW" || item.review_status === "OVERRIDDEN").length;

  const metrics = [
    ["Net GST payable", summary ? money.format(summary.box_8_net_gst_payable) : "SGD 0.00"],
    ["Transactions", String(summary?.transaction_count ?? transactions.length)],
    ["Open exceptions", String(summary?.exception_count ?? exceptions.length)],
    ["Needs review", String(summary?.needs_review_count ?? needsReview)],
    ["High severity", String(summary?.high_exception_count ?? high)]
  ];

  return (
    <section className="grid gap-4 lg:grid-cols-[1.5fr_repeat(5,1fr)]">
      <div className="panel flex min-h-28 flex-col justify-center p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Compliance cockpit</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
      </div>
      {metrics.map(([label, value]) => (
        <div key={label} className="panel flex min-h-28 flex-col justify-center p-4">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</span>
          <strong className="mt-3 text-2xl font-semibold text-ink">{value}</strong>
        </div>
      ))}
    </section>
  );
}
