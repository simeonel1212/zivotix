// Flutterwave v3 "Standard" — hosted checkout.
//
// This is the rail that lets a buyer be charged in the event's own currency
// instead of naira. It was deleted in July 2026 on the belief that Paystack
// had made it redundant; that belief conflated two different things. Paystack
// approved *international cards*, which is true, with Paystack enabling *USD
// as a collection currency*, which was never true. A Thai buyer's ฿535 was
// converted to $15.96, Paystack answered "Currency not supported by merchant"
// before the card was ever contacted, and three published events could take
// no money at all. Hence its return.
//
// Why v3 and not v4, given src/lib/flutterwave.ts is already a v4 client:
// v4 has no hosted payment page. Its card flow (/orchestration/direct-charges)
// expects the *merchant* to collect and encrypt the PAN, expiry and CVV, which
// would put Zivotix inside PCI-DSS scope for the sake of a redirect. v3's
// /payments returns a link Flutterwave hosts, exactly like Paystack's
// authorization_url. The v4 client stays for Apple/Google Pay.
//
// The two auth schemes are different and not interchangeable: v4 is OAuth
// client_credentials (FLUTTERWAVE_CLIENT_ID/SECRET), v3 is a static secret key
// (FLWSECK-…). Having the former on Vercel does not give you the latter.

const FLW_V3_BASE = "https://api.flutterwave.com/v3";

// Currencies Flutterwave can actually collect in.
//
// Deliberately a conservative allowlist rather than "whatever the event is
// priced in". Flutterwave's API accepts a 163-currency enum, but the enum
// describes the API, not this merchant account — and mistaking the first for
// the second is precisely what caused the outage. Anything not on this list
// converts to USD, and if USD itself isn't enabled the router falls back to
// Paystack in naira.
//
// THB is absent on purpose: Flutterwave does not collect Thai baht, so a
// Bangkok event settles in USD either way.
const FLW_COLLECTABLE = new Set([
  "NGN",
  "USD",
  "GBP",
  "EUR",
  "KES",
  "GHS",
  "ZAR",
  "UGX",
  "TZS",
  "RWF",
  "ZMW",
  "MWK",
  "XOF",
  "XAF",
  "EGP",
]);

export function flutterwaveCollects(currency: string): boolean {
  return FLW_COLLECTABLE.has(currency.toUpperCase());
}

// Whether the v3 rail is usable at all. False until FLUTTERWAVE_SECRET_KEY is
// set on Vercel, which keeps every caller on Paystack rather than failing —
// the whole point being that switching this on is a deliberate act, not
// something that half-happens on deploy.
export function flutterwaveV3Configured(): boolean {
  return Boolean(process.env.FLUTTERWAVE_SECRET_KEY);
}

function secretKey(): string {
  const key = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!key) throw new Error("FLUTTERWAVE_SECRET_KEY is not set");
  return key;
}

export interface InitCheckoutArgs {
  /** Major currency unit — 535 for ฿535. Not subunits, unlike Paystack. */
  amount: number;
  currency: string;
  /** Our own reference. Must be unique across every transaction, ever. */
  reference: string;
  redirectUrl: string;
  customer: { email: string; name: string; phone?: string | null };
  title?: string;
  logo?: string | null;
  meta?: Record<string, unknown>;
}

// Creates a hosted payment page and returns its URL.
//
// Throws on any non-success response — including "currency not supported",
// which is the failure mode that matters. Callers are expected to catch and
// fall back rather than surface it to the buyer.
export async function initFlutterwaveCheckout(args: InitCheckoutArgs): Promise<{ link: string }> {
  const res = await fetch(`${FLW_V3_BASE}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tx_ref: args.reference,
      amount: Math.round(args.amount * 100) / 100,
      currency: args.currency.toUpperCase(),
      redirect_url: args.redirectUrl,
      customer: {
        email: args.customer.email,
        name: args.customer.name,
        ...(args.customer.phone ? { phone_number: args.customer.phone } : {}),
      },
      customizations: {
        title: args.title ?? "Zivotix",
        ...(args.logo ? { logo: args.logo } : {}),
      },
      // Cards only. Flutterwave would happily offer bank transfer and USSD,
      // but both are naira-domestic and settle asynchronously — a buyer who
      // picks one leaves the page owing money and holding no ticket, and the
      // reservation expires 20 minutes later.
      payment_options: "card",
      meta: args.meta,
    }),
  });

  const data = await res.json().catch(() => ({}));
  const link = data?.data?.link;
  if (!res.ok || data?.status !== "success" || !link) {
    throw new Error(
      data?.message ?? `Flutterwave checkout init failed (HTTP ${res.status}): ${JSON.stringify(data)}`
    );
  }
  return { link: link as string };
}

export interface FlutterwaveVerification {
  status: "successful" | "failed" | "pending";
  amount: number;
  currency: string;
  reference: string;
  /** Flutterwave's own id, worth storing for refunds and support. */
  transactionId: number | null;
}

// Confirms a transaction by our reference.
//
// Verifying by tx_ref rather than by Flutterwave's transaction id matters:
// the buyer comes back to a URL we control and we already know our own
// reference, so there's nothing to trust from the query string. A tampered
// ?transaction_id= can't make an unpaid order look paid.
export async function verifyFlutterwaveByReference(
  reference: string
): Promise<FlutterwaveVerification> {
  const res = await fetch(
    `${FLW_V3_BASE}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secretKey()}` }, cache: "no-store" }
  );
  const data = await res.json().catch(() => ({}));

  if (!res.ok || data?.status !== "success" || !data?.data) {
    // Flutterwave 404s a reference it has never seen — which is the normal
    // answer for a buyer who abandoned the hosted page.
    return { status: "pending", amount: 0, currency: "", reference, transactionId: null };
  }

  const d = data.data;
  return {
    status: d.status === "successful" ? "successful" : d.status === "failed" ? "failed" : "pending",
    amount: Number(d.amount ?? 0),
    currency: String(d.currency ?? ""),
    reference: String(d.tx_ref ?? reference),
    transactionId: d.id ?? null,
  };
}

// Guards against a class of bug that silently underdelivers value: a verified
// "successful" transaction whose amount or currency doesn't match what we
// asked for. Flutterwave returns what was actually paid, so comparing it to
// what we recorded catches both tampering and our own rounding mistakes.
export function verificationMatchesOrder(
  v: FlutterwaveVerification,
  expected: { amount: number; currency: string }
): boolean {
  if (v.status !== "successful") return false;
  if (v.currency.toUpperCase() !== expected.currency.toUpperCase()) return false;
  // A buyer overpaying is fine; underpaying is not. Tolerance covers the
  // rounding Flutterwave applies to minor units.
  return v.amount + 0.01 >= expected.amount;
}
