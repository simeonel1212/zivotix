import { convert, toSubunit } from "@/lib/fx";
import { initTransaction } from "@/lib/paystack";
import { initFlutterwaveCheckout } from "@/lib/flutterwave-v3";
import {
  createFlutterwaveCustomer,
  createApplePayPaymentMethod,
  createCharge,
} from "@/lib/flutterwave";
import { routeChain, type PaymentRoute } from "@/lib/payment-router";

// Turns "charge this person this much" into a hosted payment page, whichever
// processor that turns out to mean.
//
// Tickets, passes and merch all pay through here. They used to each build
// their own Paystack call, which meant a currency fix had to be made three
// times and was in practice made once.
//
// The important property is the fallback. If the preferred processor refuses —
// wrong currency for the account, credentials rotated, Flutterwave having a
// bad afternoon — the buyer is not shown an error. The charge is recomputed in
// naira and sent to Paystack, which is the one route with completed payments
// behind it. A currency the merchant can't collect becomes a worse exchange
// rate for that buyer instead of a checkout that takes no money, which is what
// happened on 1 August.

export interface StartPaymentArgs {
  /** Total the buyer owes, in the event's own currency, fee included. */
  amount: number;
  currency: string;
  reference: string;
  buyer: { email: string; name: string; phone?: string | null };
  /** Where the processor sends them once they're done. */
  redirectUrl: string;
  title?: string;
  logo?: string | null;
  meta?: Record<string, unknown>;
  /**
   * ISO country of the buyer, from the edge network. Decides whether they can
   * physically be charged in a foreign currency — a Nigerian naira card
   * cannot. Null just means "unknown", and the routing falls back to deciding
   * on the event's currency alone.
   */
  buyerCountry?: string | null;
  /**
   * Set when the buyer tapped Apple Pay rather than Pay by card. Tried first
   * and falls through to the ordinary card chain if it fails, so a wallet that
   * isn't enabled costs a redirect rather than a sale.
   */
  wallet?: "applepay";
}

export interface StartedPayment {
  provider: PaymentRoute["provider"];
  chargeCurrency: string;
  chargeAmount: number;
  fxRate: number;
  /** Send the buyer here. */
  paymentUrl: string;
  /**
   * Flutterwave's v4 charge id, set only on the wallet path. The return page
   * verifies against this instead of by reference, and refunds key on it.
   */
  providerChargeId?: string;
  /** Every route attempted, in order. Worth persisting when one fails. */
  trail: string[];
}

async function attempt(route: PaymentRoute, args: StartPaymentArgs): Promise<StartedPayment> {
  const { amount: chargeAmount, rate } = await convert(args.amount, args.currency, route.chargeCurrency);

  if (route.provider === "flutterwave") {
    const { link } = await initFlutterwaveCheckout({
      amount: chargeAmount,
      currency: route.chargeCurrency,
      reference: args.reference,
      redirectUrl: args.redirectUrl,
      customer: args.buyer,
      title: args.title,
      logo: args.logo,
      meta: args.meta,
    });
    return {
      provider: "flutterwave",
      chargeCurrency: route.chargeCurrency,
      chargeAmount,
      fxRate: rate,
      paymentUrl: link,
      trail: [route.reason],
    };
  }

  const tx = await initTransaction({
    email: args.buyer.email,
    amount: toSubunit(chargeAmount),
    currency: route.chargeCurrency,
    reference: args.reference,
    callback_url: args.redirectUrl,
    metadata: args.meta ?? {},
    channels: ["card", "apple_pay"],
  });
  return {
    provider: "paystack",
    chargeCurrency: route.chargeCurrency,
    chargeAmount,
    fxRate: rate,
    paymentUrl: tx.authorization_url,
    trail: [route.reason],
  };
}

// Apple Pay, on Flutterwave's v4 API.
//
// A separate rail from everything else in this file because v3 — the hosted
// checkout the card path uses — has no wallet support at all. Its documented
// payment_options list contains no wallets, and a real checkout page confirms
// it: card, USSD, bank, bank transfer, eNaira. That is the whole reason this
// repo carries two Flutterwave clients.
//
// No Apple Pay JS here, and none is needed. v4 takes a payment-method object,
// returns a redirect URL, and presents the Apple Pay sheet on its own page —
// so there is no merchant validation endpoint to run and no Apple developer
// certificate to keep alive on our side.
async function attemptApplePay(
  route: PaymentRoute,
  args: StartPaymentArgs
): Promise<StartedPayment> {
  const { amount: chargeAmount, rate } = await convert(
    args.amount,
    args.currency,
    route.chargeCurrency
  );

  const customer = await createFlutterwaveCustomer({
    email: args.buyer.email,
    name: args.buyer.name,
  });
  const method = await createApplePayPaymentMethod(args.buyer.name);

  const charge = await createCharge({
    customerId: customer.id,
    paymentMethodId: method.id,
    // v4 amounts are in major units — 12.50, not 1250. The opposite of
    // Paystack, and an easy way to charge a buyer a hundred times over.
    amount: chargeAmount,
    currency: route.chargeCurrency,
    reference: args.reference,
    redirectUrl: args.redirectUrl,
    meta: args.meta,
  });

  const url = charge.next_action?.redirect_url?.url;
  if (!url) {
    throw new Error("Flutterwave returned no Apple Pay redirect");
  }

  return {
    provider: "flutterwave",
    chargeCurrency: route.chargeCurrency,
    chargeAmount,
    fxRate: rate,
    paymentUrl: url,
    providerChargeId: charge.id,
    trail: [`Apple Pay in ${route.chargeCurrency}`],
  };
}

export async function startPayment(args: StartPaymentArgs): Promise<StartedPayment> {
  const chain = routeChain(args.currency, args.buyerCountry ?? null);
  const trail: string[] = [];

  // Wallet first when asked for, but never as the only option. If Apple Pay
  // isn't enabled on the account, or the charge is refused, the buyer lands on
  // the ordinary card checkout instead of an error — they tapped a button
  // expecting to pay, and the worst outcome is that they type a card number.
  if (args.wallet === "applepay") {
    const walletRoute = chain.find((r) => r.provider === "flutterwave") ?? chain[0];

    // Apple Pay is enabled on this Flutterwave account but not for naira, so a
    // naira route is a guaranteed refusal. Skipping it saves the buyer a round
    // trip to an API call that cannot succeed, and records why.
    if (walletRoute.chargeCurrency === "NGN") {
      trail.push("Apple Pay skipped: not supported for NGN");
    } else {
      try {
        return await attemptApplePay(walletRoute, args);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        trail.push(`Apple Pay refused: ${message}`);
        console.error(`[start-payment] Apple Pay refused ${args.reference}: ${message}`);
      }
    }
  }

  for (let i = 0; i < chain.length; i++) {
    const route = chain[i];
    try {
      const started = await attempt(route, args);
      return { ...started, trail: [...trail, route.reason] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      trail.push(`${route.reason} — refused: ${message}`);

      // Out of routes. Surface the real reason rather than a generic failure,
      // because by this point every rail has said no and someone needs to know
      // which one said what.
      if (i === chain.length - 1) {
        console.error(`[start-payment] every route refused ${args.reference}: ${trail.join(" | ")}`);
        throw error;
      }

      console.error(`[start-payment] ${route.provider} refused ${args.reference}: ${message}`);
    }
  }

  // Unreachable: routeChain never returns an empty array.
  throw new Error("No payment route available");
}
