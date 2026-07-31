import { serviceFeeRate } from "@/lib/fees";
import { formatMoney } from "@/lib/currencies";

// What Zivotix costs, next to what everyone else costs.
//
// Competitors publish their fees on their own homepages; not answering the
// question here just means an organizer goes and finds the answer somewhere
// less flattering to us. Since Zivotix is genuinely the cheapest of the four,
// the comparison is the argument — a percentage on its own means nothing until
// you can see what the alternatives charge for the same ticket.
//
// Rates verified July 2026 from each platform's public pricing page. If they
// move, this block is lying, so it's worth re-checking before quoting it.
const COMPETITORS = [
  { name: "Bubbl", ngn: null, intl: { rate: 0.1, flat: 0.99, cur: "USD" } },
  { name: "Tix.africa", ngn: { rate: 0.08, flat: 100 }, intl: { rate: 0.07, flat: 0.5, cur: "USD" } },
];

function feeOn(amount: number, rate: number, flat: number) {
  return amount * rate + flat;
}

export default function FeeComparison() {
  const NGN_TICKET = 10000;
  const USD_TICKET = 30;
  const ngnRate = serviceFeeRate("NGN");
  const usdRate = serviceFeeRate("USD");

  const rows = [
    {
      label: "Nigeria",
      ticket: formatMoney(NGN_TICKET, "NGN"),
      ours: formatMoney(feeOn(NGN_TICKET, ngnRate, 0), "NGN"),
      theirs: COMPETITORS.filter((c) => c.ngn).map((c) => ({
        name: c.name,
        fee: formatMoney(feeOn(NGN_TICKET, c.ngn!.rate, c.ngn!.flat), "NGN"),
      })),
    },
    {
      label: "Everywhere else",
      ticket: formatMoney(USD_TICKET, "USD"),
      ours: formatMoney(feeOn(USD_TICKET, usdRate, 0), "USD"),
      theirs: COMPETITORS.map((c) => ({
        name: c.name,
        fee: formatMoney(feeOn(USD_TICKET, c.intl.rate, c.intl.flat), c.intl.cur),
      })),
    },
  ];

  return (
    <section className="zv-card p-7 sm:p-10">
      <div className="max-w-xl">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
          {Math.round(ngnRate * 100)}% in Nigeria. {Math.round(usdRate * 100)}% everywhere else.
        </h2>
        <p className="mt-2 text-neutral-500">
          No monthly fee, no listing fee, and no fixed charge stapled onto every ticket. Buyers see
          the fee before they pay, and you keep your full ticket price.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded-2xl border border-neutral-100 bg-neutral-50/60 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              {row.label} · on a {row.ticket} ticket
            </p>

            <div className="mt-4 flex items-baseline justify-between gap-3">
              <span className="font-bold text-neutral-900">Zivotix</span>
              <span className="text-xl font-bold zv-gradient-text tabular-nums">{row.ours}</span>
            </div>

            <div className="mt-3 space-y-2 border-t border-neutral-200/70 pt-3">
              {row.theirs.map((c) => (
                <div key={c.name} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-neutral-500">{c.name}</span>
                  <span className="text-neutral-400 tabular-nums">{c.fee}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-5 text-xs text-neutral-400">
        Competitor rates from their published pricing, July 2026. Card processing is charged
        separately by the payment provider in every case, including ours.
      </p>
    </section>
  );
}
