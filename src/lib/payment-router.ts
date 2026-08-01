// Relative, with the extension, so the node test runner can load this module
// without the Next.js path-alias resolver. The rest of the app imports it as
// "@/lib/payment-router" as usual.
import { flutterwaveCollects, flutterwaveV3Configured } from "./flutterwave-v3.ts";

// Which processor takes the money, and in what currency.
//
// One function, because the answer has to be identical for tickets, passes and
// merch — three checkout routes that each used to work it out for themselves.
// The outage on 1 August came from a currency decision made in one place and
// assumed everywhere else.
//
// The shape of the answer:
//
//   NGN event            → Paystack, in NGN
//   currency Flutterwave → Flutterwave, in that currency
//   collects
//   anything else        → Flutterwave, in USD
//   Flutterwave off      → Paystack, in NGN
//
// Naira stays on Paystack rather than moving with everything else. It isn't
// sentiment: Paystack's local rate is 1.5% capped at ₦2,000 against
// Flutterwave's 1.4% uncapped, so above roughly ₦140,000 an order Paystack is
// materially cheaper, and every naira payment this platform has ever taken has
// settled there. Flutterwave is being brought back to solve foreign currency,
// which is the thing Paystack genuinely cannot do on this account. To put
// naira on Flutterwave too, delete the first branch.

export type Provider = "paystack" | "flutterwave";

// A union rather than a struct, so the invariant that broke on 1 August is
// enforced by the compiler: Paystack cannot be handed a currency other than
// naira, because there is no way to spell one.
export type PaymentRoute = {
  /** Why, in a form that's readable in logs and in a support conversation. */
  reason: string;
} & (
  | { provider: "paystack"; chargeCurrency: "NGN" }
  | { provider: "flutterwave"; chargeCurrency: string }
);

export function resolvePaymentRoute(eventCurrency: string): PaymentRoute {
  const currency = (eventCurrency || "NGN").toUpperCase();

  if (currency === "NGN") {
    return { provider: "paystack", chargeCurrency: "NGN", reason: "naira settles on Paystack" };
  }

  // Not configured yet — FLUTTERWAVE_SECRET_KEY absent. Everything keeps
  // working the way it does today rather than erroring, which is the point:
  // turning Flutterwave on is a deliberate act, not a side effect of a deploy.
  if (!flutterwaveV3Configured()) {
    return {
      provider: "paystack",
      chargeCurrency: "NGN",
      reason: "Flutterwave not configured; converting to naira",
    };
  }

  if (flutterwaveCollects(currency)) {
    return {
      provider: "flutterwave",
      chargeCurrency: currency,
      reason: "Flutterwave collects this currency directly",
    };
  }

  // THB, INR, AED and friends: priced locally, charged in dollars. Still an
  // improvement on naira, where the buyer's bank converts a second time.
  return {
    provider: "flutterwave",
    chargeCurrency: "USD",
    reason: `Flutterwave does not collect ${currency}; charging in USD`,
  };
}

// The route to use when the preferred one fails at init.
//
// Every non-NGN charge has exactly one proven fallback: naira on Paystack.
// It is not the nicest experience — the buyer's bank converts back at its own
// rate — but it is the only path with a completed payment behind it, and a
// worse rate beats a checkout that cannot take money at all.
export function fallbackRoute(): PaymentRoute {
  return {
    provider: "paystack",
    chargeCurrency: "NGN",
    reason: "fell back to Paystack after the preferred processor refused",
  };
}
