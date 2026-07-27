// Zivotix's revenue: a 5% service fee on every paid ticket.
//
// This replaced a 3% commission deducted from the organizer's payout, which
// was below cost. Paystack charges 1.5% + ₦100 locally and 3.9% + ₦100
// internationally, both plus 7.5% VAT — so on a ₦5,000 ticket the processor
// alone took 3.8%, and every international sale lost money outright. The old
// model also paid organizers `gross × (1 − rate)` regardless of what the
// processor actually took, so the shortfall came out of the platform.

export const SERVICE_FEE_RATE = 0.05;

// Known, deliberate gap: Paystack's flat ₦100 kicks in once the charged
// total reaches ₦2,500, so face values around ₦2,400–₦3,250 cost marginally
// more to process than 5% brings in — at most about ₦30 an order. A minimum
// fee would close it, but a flat floor on a ₦1,000 ticket reads as gouging,
// and "5%" is worth more as a promise than thirty naira is as margin.

/**
 * Who the fee is visible to.
 *
 * `pass` — added on top. Buyer pays 10,500 on a 10,000 ticket; the organizer
 * receives the full 10,000. The default, and what most organizers choose.
 *
 * `absorb` — included in the price. Buyer pays exactly the 10,000 advertised;
 * the organizer receives 9,500. Costs the organizer money but keeps their
 * headline price honest, which matters when they've already put 10,000 on a
 * flyer.
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
  mode: FeeMode;
}

export function computeFees(subtotal: number, mode: FeeMode = "pass"): FeeBreakdown {
  if (subtotal <= 0) {
    return { subtotal, serviceFee: 0, total: subtotal, organizerReceives: subtotal, mode };
  }

  const serviceFee = Math.round(subtotal * SERVICE_FEE_RATE * 100) / 100;

  if (mode === "absorb") {
    return {
      subtotal,
      serviceFee,
      total: subtotal,
      organizerReceives: Math.round((subtotal - serviceFee) * 100) / 100,
      mode,
    };
  }

  return {
    subtotal,
    serviceFee,
    total: Math.round((subtotal + serviceFee) * 100) / 100,
    organizerReceives: subtotal,
    mode,
  };
}

/** Shared wording, so checkout and the organizer dashboard agree. */
export function serviceFeeLabel() {
  return `${(SERVICE_FEE_RATE * 100).toFixed(0)}% service fee`;
}
