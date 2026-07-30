// Zivotix's revenue: a service fee on every paid ticket, charged to the buyer
// rather than deducted from the organizer.
//
// This replaced a 3% organizer-side commission that was below cost. Paystack
// charges 1.5% + ₦100 locally and 3.9% internationally, both plus 7.5% VAT — so
// on a ₦5,000 ticket the processor alone took 3.8%, and every foreign sale lost
// money outright.

/**
 * Rate by the event's pricing currency, set so that margin is roughly
 * comparable across markets rather than nominally equal.
 *
 * NGN — 5%. Charged locally at 1.5% + ₦100 + VAT, so 5% nets about 2.2% of
 * face value on a ₦10,000 ticket. Held at 5% deliberately: Tix.africa charges
 * 8% + ₦100 (roughly 9%), so "half of what you're paying now" is a sharper
 * pitch than the extra point of margin is worth.
 *
 * Everything else — 7%. Non-NGN events are converted to USD at checkout, which
 * makes them international transactions at ~4.2% after VAT, with no cap. At 5%
 * that left only 0.6% of face value — barely enough to cover a payout wire fee.
 * 7% nets about 2.5%, roughly matching the Nigerian margin. Still below
 * Eventbrite and well below Tix.
 *
 * The rate is deliberately keyed to the *event's* currency, not the buyer's
 * card. A Thai event is priced in THB and always settles as USD, so the cost
 * is known up front — whereas card origin isn't knowable until Paystack
 * responds, and a fee that changed after checkout would be indefensible.
 */
const RATE_BY_CURRENCY: Record<string, number> = {
  NGN: 0.05,
};
const DEFAULT_RATE = 0.07;

export function serviceFeeRate(currency: string): number {
  return RATE_BY_CURRENCY[currency?.toUpperCase()] ?? DEFAULT_RATE;
}

// Known, deliberate gap on NGN: Paystack's flat ₦100 starts once the charged
// total reaches ₦2,500, so face values from roughly ₦2,380 to ₦3,400 cost
// marginally more to process than 5% brings in — up to about ₦30 an order.
// Accepted rather than closed, because the cheapest ticket on the platform is
// ₦8,000 and a rate rise would cost the "half of Tix" pitch. Revisit only if
// sub-₦4,000 tickets become a real share of volume.

/**
 * Who the fee is visible to.
 *
 * `pass` — added on top. Buyer pays 10,500 on a 10,000 NGN ticket; the
 * organizer receives the full 10,000. The default.
 *
 * `absorb` — included in the price. Buyer pays exactly the 10,000 advertised;
 * the organizer receives 9,500. Costs the organizer money but keeps their
 * headline price honest, which matters when it's already on a flyer.
 */
export type FeeMode = "pass" | "absorb";

export interface FeeBreakdown {
  /** Face value of the tickets as listed. */
  subtotal: number;
  /** Zivotix's cut. Paid by the buyer under `pass`, by the organizer under `absorb`. */
  serviceFee: number;
  /** What the buyer is charged, before currency conversion. */
  total: number;
  /** What the organizer is owed, and what lands in orders.base_amount. */
  organizerReceives: number;
  /** The rate applied, as a fraction — useful for display and for tests. */
  rate: number;
  mode: FeeMode;
}

export function computeFees(
  subtotal: number,
  currency: string,
  mode: FeeMode = "pass"
): FeeBreakdown {
  const rate = serviceFeeRate(currency);

  if (subtotal <= 0) {
    return { subtotal, serviceFee: 0, total: subtotal, organizerReceives: subtotal, rate, mode };
  }

  const serviceFee = Math.round(subtotal * rate * 100) / 100;

  if (mode === "absorb") {
    return {
      subtotal,
      serviceFee,
      total: subtotal,
      organizerReceives: Math.round((subtotal - serviceFee) * 100) / 100,
      rate,
      mode,
    };
  }

  return {
    subtotal,
    serviceFee,
    total: Math.round((subtotal + serviceFee) * 100) / 100,
    organizerReceives: subtotal,
    rate,
    mode,
  };
}

/** Shared wording, so checkout and the organizer dashboard always agree. */
export function serviceFeeLabel(currency: string) {
  return `${(serviceFeeRate(currency) * 100).toFixed(0)}% service fee`;
}
