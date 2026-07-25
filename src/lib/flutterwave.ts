// Thin wrapper around Flutterwave's v4 API — used for exactly two things:
// Apple Pay and Google Pay, as a second payment rail alongside Paystack
// (which doesn't support either wallet on this account). Everything else
// (cards, bank transfer, browsers without either wallet) still goes through
// Paystack.
// Docs: https://developer.flutterwave.com/docs/apple-pay
//       https://developer.flutterwave.com/docs/googlepay
//
// v4 auth is OAuth2 client_credentials, not a static secret key like
// Paystack — tokens expire after 10 minutes, so we cache one in memory and
// refresh it a little early. Good enough for a serverless function: worst
// case a cold start fetches a fresh token, warm invocations reuse it.

const FLW_ENV = process.env.FLUTTERWAVE_ENV === "sandbox" ? "sandbox" : "live";
const FLW_BASE =
  FLW_ENV === "sandbox" ? "https://developersandbox-api.flutterwave.com" : "https://f4bexperience.flutterwave.com";
const FLW_TOKEN_URL = "https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token";

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - Date.now() > 60_000) {
    return cachedToken.value;
  }

  const res = await fetch(FLW_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.FLUTTERWAVE_CLIENT_ID!,
      client_secret: process.env.FLUTTERWAVE_CLIENT_SECRET!,
      grant_type: "client_credentials",
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description ?? "Could not authenticate with Flutterwave");
  }

  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

async function authHeaders() {
  return {
    Authorization: `Bearer ${await getAccessToken()}`,
    "Content-Type": "application/json",
    "X-Trace-Id": crypto.randomUUID(),
    "X-Idempotency-Key": crypto.randomUUID(),
  };
}

// Shared by both wallets — a Flutterwave customer isn't wallet-specific.
// Buyers who've paid via Apple/Google Pay before already have a Flutterwave
// customer record under their email — creating a second one 409s with
// CUSTOMER_ALREADY_EXISTS, so on that specific error we look the existing
// customer up by email instead of failing the whole checkout.
export async function createFlutterwaveCustomer(args: { email: string; name: string }) {
  const [first, ...rest] = args.name.trim().split(/\s+/);
  const res = await fetch(`${FLW_BASE}/customers`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      email: args.email,
      name: { first: first || args.name, last: rest.join(" ") || first || args.name },
    }),
  });
  const data = await res.json();
  if (!res.ok || data.status !== "success") {
    if (res.status === 409 && data.error?.type === "CUSTOMER_ALREADY_EXISTS") {
      return findFlutterwaveCustomerByEmail(args.email);
    }
    throw new Error(
      data.message ?? `Could not create Flutterwave customer (HTTP ${res.status}): ${JSON.stringify(data)}`
    );
  }
  return data.data as { id: string };
}

async function findFlutterwaveCustomerByEmail(email: string) {
  const res = await fetch(`${FLW_BASE}/customers/search`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  const match = data?.data?.[0];
  if (!res.ok || data.status !== "success" || !match?.id) {
    throw new Error(
      data.message ?? `Could not find existing Flutterwave customer (HTTP ${res.status}): ${JSON.stringify(data)}`
    );
  }
  return match as { id: string };
}

export async function createApplePayPaymentMethod(cardHolderName: string) {
  const res = await fetch(`${FLW_BASE}/payment-methods`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ type: "applepay", applepay: { card_holder_name: cardHolderName } }),
  });
  const data = await res.json();
  if (!res.ok || data.status !== "success") {
    throw new Error(
      data.message ?? `Could not create Apple Pay payment method (HTTP ${res.status}): ${JSON.stringify(data)}`
    );
  }
  return data.data as { id: string };
}

export async function createGooglePayPaymentMethod(cardHolderName: string) {
  const res = await fetch(`${FLW_BASE}/payment-methods`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ type: "googlepay", googlepay: { card_holder_name: cardHolderName } }),
  });
  const data = await res.json();
  if (!res.ok || data.status !== "success") {
    throw new Error(
      data.message ?? `Could not create Google Pay payment method (HTTP ${res.status}): ${JSON.stringify(data)}`
    );
  }
  return data.data as { id: string };
}

export interface CreateChargeArgs {
  customerId: string;
  paymentMethodId: string;
  amount: number; // major currency unit, e.g. 12.50 USD — NOT subunits (unlike Paystack)
  currency: string;
  reference: string;
  redirectUrl: string;
  meta?: Record<string, unknown>;
}

export async function createCharge(args: CreateChargeArgs) {
  const res = await fetch(`${FLW_BASE}/charges`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      reference: args.reference,
      currency: args.currency,
      customer_id: args.customerId,
      payment_method_id: args.paymentMethodId,
      redirect_url: args.redirectUrl,
      amount: args.amount,
      meta: args.meta,
    }),
  });
  const data = await res.json();
  if (!res.ok || data.status !== "success") {
    throw new Error(
      data.message ?? `Could not create Flutterwave charge (HTTP ${res.status}): ${JSON.stringify(data)}`
    );
  }
  return data.data as {
    id: string;
    status: "pending" | "succeeded" | "failed";
    reference: string;
    next_action?: { type: "redirect_url"; redirect_url: { url: string } };
  };
}

export async function getCharge(chargeId: string) {
  const res = await fetch(`${FLW_BASE}/charges/${encodeURIComponent(chargeId)}`, {
    headers: await authHeaders(),
  });
  const data = await res.json();
  if (!res.ok || data.status !== "success") {
    throw new Error(data.message ?? "Could not fetch Flutterwave charge");
  }
  return data.data as { id: string; status: "pending" | "succeeded" | "failed"; amount: number; currency: string; reference: string };
}

// Refunds a charge in full. Flutterwave settles refunds back to the buyer's
// original payment method — 3-15 days for card-backed Apple Pay.
export async function refundCharge(chargeId: string, amount: number, reason: string) {
  const res = await fetch(`${FLW_BASE}/refunds`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ charge_id: chargeId, amount, reason }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message ?? "Flutterwave refund failed");
  }
  return data.data as { id: string; status: string };
}

// Verifies the `flutterwave-signature` header on incoming webhooks.
// Flutterwave HMAC-SHA256-signs the raw request body with the secret hash
// you set on your dashboard, base64-encoded.
export async function verifyFlutterwaveWebhookSignature(rawBody: string, signature: string | null) {
  if (!signature) return false;
  const crypto = await import("node:crypto");
  const hash = crypto
    .createHmac("sha256", process.env.FLUTTERWAVE_SECRET_HASH!)
    .update(rawBody)
    .digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false; // length mismatch etc — definitely not a match
  }
}
