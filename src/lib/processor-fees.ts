// Estimates what Paystack or Flutterwave actually deduct before a sale ever
// reaches the platform's account, purely for visibility into real margin —
// see payouts.processor_fee_estimate in schema.sql. This never changes what
// an organizer is actually paid (net_payable is still gross * (1 -
// commission_rate), a fixed contract), it just shows what's really left over
// for the platform after the processor's own cut.
//
// Rates are each provider's current published local-transaction pricing
// (checked July 2026): Paystack NGN card 1.5% + ₦100 (waived under ₦2,500,
// capped at ₦2,000) + 7.5% VAT on the fee; Flutterwave Apple Pay flat 4.8%.
// This is an approximation — it doesn't distinguish international cards on
// Paystack (which cost more, 3.9% + ₦100) since that isn't tracked per
// order today, and it doesn't attempt cross-currency FX reconciliation of
// the fee itself.
export function estimateProcessorFee(
  provider: "paystack" | "flutterwave",
  amount: number,
  currency: string
): number {
  if (provider === "paystack") {
    let fee = amount * 0.015;
    if (currency === "NGN") {
      if (amount >= 2500) fee += 100;
      fee = Math.min(fee, 2000);
    }
    const vat = fee * 0.075;
    return Math.round((fee + vat) * 100) / 100;
  }
  // Flutterwave — flat rate across the alternative payment methods we use (Apple Pay).
  return Math.round(amount * 0.048 * 100) / 100;
}
