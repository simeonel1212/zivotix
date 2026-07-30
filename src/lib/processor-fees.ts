// Estimates what the payment processor actually deducts before a sale reaches
// the platform's account — see payouts.processor_fee_estimate in schema.sql.
// This never changes what an organizer is paid (they receive orders.base_amount
// in full); it exists so platform margin reporting tells the truth.
//
// Rates checked July 2026:
//   Paystack, NGN card:       1.5% + ₦100, flat fee waived under ₦2,500,
//                             percentage capped at ₦2,000, then 7.5% VAT
//   Paystack, international:  3.9%, then 7.5% VAT — no cap
//   Flutterwave:              flat 4.8% (dormant; kept for historic orders)
//
// The international rate is the one that matters most and used to be missing.
// Every non-NGN event is converted to USD at checkout (see resolveChargeCurrency
// in lib/fx.ts), so a Thai or Kenyan sale is an international transaction to
// Paystack at roughly 4.2% after VAT — nearly three times the local rate.
// Charging all Paystack sales at 1.5% made international margin look four
// times healthier than it is, on exactly the sales that earn least.

const VAT = 0.075;

/** Paystack's local NGN card rate: percentage, flat fee, and a cap. */
const NGN_RATE = 0.015;
const NGN_FLAT = 100;
const NGN_FLAT_THRESHOLD = 2500;
const NGN_CAP = 2000;

/** Paystack's international card rate. Applies to every non-NGN charge. */
const INTERNATIONAL_RATE = 0.039;

const FLUTTERWAVE_RATE = 0.048;

// Known blind spot: a buyer abroad paying for an NGN-priced event is charged in
// NGN on a foreign card, which Paystack bills at the international rate — but
// nothing in the order tells us the card's country, so this still costs it as
// local. Those sales are therefore reported slightly more favourably than they
// are. Margin stays positive (6% against ~4.2%), so it understates profit
// rather than hiding a loss; fixing it properly needs card-country data from
// the Paystack webhook.
export function estimateProcessorFee(
  provider: "paystack" | "flutterwave",
  amount: number,
  /**
   * The currency the buyer was actually charged in — orders.charge_currency,
   * not the event's pricing currency. NGN means a local card; anything else
   * (USD in practice) is an international transaction.
   */
  chargeCurrency: string
): number {
  if (provider === "paystack") {
    let fee: number;
    if (chargeCurrency === "NGN") {
      fee = amount * NGN_RATE;
      if (amount >= NGN_FLAT_THRESHOLD) fee += NGN_FLAT;
      fee = Math.min(fee, NGN_CAP);
    } else {
      // No flat component and no cap on international: a large foreign sale
      // costs proportionally the same as a small one.
      fee = amount * INTERNATIONAL_RATE;
    }
    return Math.round(fee * (1 + VAT) * 100) / 100;
  }
  return Math.round(amount * FLUTTERWAVE_RATE * 100) / 100;
}
