import { convert, toSubunit } from "@/lib/fx";
import { initTransaction } from "@/lib/paystack";
import { initFlutterwaveCheckout } from "@/lib/flutterwave-v3";
import { resolvePaymentRoute, fallbackRoute, type PaymentRoute } from "@/lib/payment-router";

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
}

export interface StartedPayment {
  provider: PaymentRoute["provider"];
  chargeCurrency: string;
  chargeAmount: number;
  fxRate: number;
  /** Send the buyer here. */
  paymentUrl: string;
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

export async function startPayment(args: StartPaymentArgs): Promise<StartedPayment> {
  const preferred = resolvePaymentRoute(args.currency);

  try {
    return await attempt(preferred, args);
  } catch (primaryError) {
    const fallback = fallbackRoute();

    // Nothing to fall back to — the preferred route already was the fallback.
    if (
      preferred.provider === fallback.provider &&
      preferred.chargeCurrency === fallback.chargeCurrency
    ) {
      throw primaryError;
    }

    const message = primaryError instanceof Error ? primaryError.message : String(primaryError);
    console.error(`[start-payment] ${preferred.provider} refused ${args.reference}: ${message}`);

    const recovered = await attempt(fallback, args);
    return {
      ...recovered,
      trail: [`${preferred.reason} — refused: ${message}`, fallback.reason],
    };
  }
}
