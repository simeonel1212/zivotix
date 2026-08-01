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

// Every route worth trying for this currency, best first.
//
// A chain rather than a single answer, because the failure modes are ordered.
// Charging a Thai buyer in baht is ideal; dollars is a fair second; naira is a
// last resort that still takes the money. Collapsing that into one guess is
// what made the allowlist dangerous to edit — get it wrong and buyers fell all
// the way to naira. With a chain, an optimistic entry costs one wasted API
// call, so the list can be widened without betting the checkout on it.
export function routeChain(
  eventCurrency: string,
  buyerCountry: string | null = null
): PaymentRoute[] {
  const currency = (eventCurrency || "NGN").toUpperCase();
  const naira: PaymentRoute = {
    provider: "paystack",
    chargeCurrency: "NGN",
    reason: "naira settles on Paystack",
  };

  // Not configured — FLUTTERWAVE_SECRET_KEY absent. Falls back to the old
  // world entirely rather than erroring: turning Flutterwave on is a
  // deliberate act, not a side effect of a deploy.
  if (!flutterwaveV3Configured()) {
    return [{ ...naira, reason: "Flutterwave not configured; charging naira on Paystack" }];
  }

  const chain: PaymentRoute[] = [];

  // Naira, on Flutterwave — their home market, and the only currency a
  // Nigerian card can reliably spend. Two cases land here:
  //
  //   - the event is priced in naira
  //   - the buyer is standing in Nigeria, whatever the event is priced in
  //
  // The second is a hard constraint on the buyer's side, not a preference.
  // Nigerian banks have blocked or throttled international transactions on
  // naira cards since 2022, so a dollar charge comes back "Restricted card:
  // we cannot charge your card due to bank restrictions". Nothing below can
  // rescue that: the chain catches a *processor* refusing at checkout, not an
  // *issuer* declining after the buyer has already typed their card number.
  if (currency === "NGN" || buyerCountry?.toUpperCase() === "NG") {
    chain.push({
      provider: "flutterwave",
      chargeCurrency: "NGN",
      reason:
        currency === "NGN"
          ? "naira event, charged in naira"
          : "buyer is in Nigeria; naira cards cannot pay in USD",
    });
    chain.push({ ...naira, reason: "last resort: Flutterwave refused naira" });
    return chain;
  }

  if (flutterwaveCollects(currency)) {
    chain.push({
      provider: "flutterwave",
      chargeCurrency: currency,
      reason: "Flutterwave collects this currency directly",
    });
  }

  // Dollars: the buyer's bank converts once, at its own rate, from a currency
  // it understands. Applies to THB, INR, AED and anything else Flutterwave
  // won't take natively.
  if (currency !== "USD") {
    chain.push({
      provider: "flutterwave",
      chargeCurrency: "USD",
      reason: `charging in USD; Flutterwave did not take ${currency}`,
    });
  }

  // Paystack sits underneath everything and should never run. It is kept
  // because every completed payment in this platform's history went through
  // it and not one has yet gone through Flutterwave. Retiring the only proven
  // rail on the day the new one goes live would leave the checkout with
  // nothing behind it. Remove this once Flutterwave has settled payments of
  // its own — it is a safety net, not a second processor.
  chain.push({ ...naira, reason: "last resort: Flutterwave refused" });
  return chain;
}

// The single best route. Kept for callers that only need to display a decision
// rather than execute one.
export function resolvePaymentRoute(
  eventCurrency: string,
  buyerCountry: string | null = null
): PaymentRoute {
  return routeChain(eventCurrency, buyerCountry)[0];
}

// Currency → what a card will actually be billed in, for a set of prices.
//
// Client components can't call resolvePaymentRoute — the answer depends on
// which processor is configured, which is server-only. A plain object crosses
// the server/client boundary; a function would not.
export function chargeCurrencyMap(
  currencies: string[],
  buyerCountry: string | null = null
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const c of currencies) {
    if (!c || map[c]) continue;
    map[c] = resolvePaymentRoute(c, buyerCountry).chargeCurrency;
  }
  return map;
}

// The last resort, and the only route with completed payments behind it.
// Not the nicest experience — the buyer's bank converts back at its own rate —
// but a worse rate beats a checkout that cannot take money at all.
export function fallbackRoute(): PaymentRoute {
  return {
    provider: "paystack",
    chargeCurrency: "NGN",
    reason: "fell back to Paystack after the preferred processor refused",
  };
}
