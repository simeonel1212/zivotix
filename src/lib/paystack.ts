// Thin wrapper around the Paystack REST API — no SDK dependency needed.
// Docs: https://paystack.com/docs/api/transaction/

const PAYSTACK_BASE = "https://api.paystack.co";

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    "Content-Type": "application/json",
  };
}

export interface InitTransactionArgs {
  email: string;
  amount: number; // in the smallest currency unit (kobo for NGN, cents for USD)
  currency: "NGN" | "USD";
  reference: string;
  callback_url: string;
  metadata?: Record<string, unknown>;
  // Restricts which payment options Paystack's hosted checkout shows.
  // Full list: ["card","bank","apple_pay","ussd","qr","mobile_money","bank_transfer","eft","capitec_pay","payattitude"].
  // We default this to card-only in checkout/route.ts — Apple Pay goes
  // through Flutterwave instead (Paystack's own Apple Pay isn't approved on
  // this account), so leaving Paystack's Apple Pay channel enabled would
  // just be a second, unusable button.
  channels?: string[];
}

export async function initTransaction(args: InitTransactionArgs) {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(args),
  });
  const data = await res.json();
  if (!res.ok || !data.status) {
    throw new Error(data.message ?? "Paystack initialize failed");
  }
  return data.data as { authorization_url: string; access_code: string; reference: string };
}

export async function verifyTransaction(reference: string) {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok || !data.status) {
    throw new Error(data.message ?? "Paystack verify failed");
  }
  return data.data as {
    status: "success" | "failed" | "abandoned";
    reference: string;
    amount: number;
    currency: string;
    customer: { email: string };
  };
}

// Verifies the `x-paystack-signature` header on incoming webhooks.
// Paystack signs the raw request body with HMAC-SHA512 using your secret key.
export async function verifyWebhookSignature(rawBody: string, signature: string | null) {
  if (!signature) return false;
  const crypto = await import("node:crypto");
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!)
    .update(rawBody)
    .digest("hex");
  // Constant-time compare so a forged signature can't be brute-forced byte by
  // byte off response timing (matches how the Flutterwave webhook verifies).
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false; // length mismatch etc, definitely not a match
  }
}

// Nigerian bank transfer payout (organizer country === 'NG').
export async function createTransferRecipient(args: {
  name: string;
  account_number: string;
  bank_code: string;
}) {
  const res = await fetch(`${PAYSTACK_BASE}/transferrecipient`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ type: "nuban", currency: "NGN", ...args }),
  });
  const data = await res.json();
  if (!res.ok || !data.status) throw new Error(data.message ?? "Failed to create recipient");
  return data.data as { recipient_code: string };
}

export async function initiateTransfer(args: {
  recipient_code: string;
  amount: number; // kobo
  reason: string;
  reference: string;
}) {
  const res = await fetch(`${PAYSTACK_BASE}/transfer`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ source: "balance", ...args }),
  });
  const data = await res.json();
  if (!res.ok || !data.status) throw new Error(data.message ?? "Transfer failed");
  return data.data as {
    status: "success" | "otp" | "pending" | "failed";
    reference: string;
    transfer_code: string;
  };
}

// Thai organizers can't be paid via Paystack transfer — that leg is a manual
// international wire. `payouts.reference` just records the wire reference number.

// Refunds a transaction in full. Paystack settles refunds back to the
// buyer's original payment method — typically a few business days for card,
// faster for bank transfer/USSD.
export async function refundTransaction(reference: string) {
  const res = await fetch(`${PAYSTACK_BASE}/refund`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ transaction: reference }),
  });
  const data = await res.json();
  if (!res.ok || !data.status) throw new Error(data.message ?? "Refund failed");
  return data.data as { status: string; transaction: { reference: string } };
}

// Lists banks so the organizer settings form can offer a dropdown instead of
// making people type a bank code they don't know.
//
// Paystack's bank list is per-country and each market has its own account
// format, so the query differs by country rather than being one call. Only the
// four countries Paystack settles into are supported — everywhere else is paid
// by international wire and collects SWIFT details instead.
const PAYSTACK_BANK_QUERY: Record<string, string> = {
  NG: "country=nigeria&currency=NGN&type=nuban",
  GH: "country=ghana&currency=GHS",
  ZA: "country=south%20africa&currency=ZAR",
  KE: "country=kenya&currency=KES",
};

export async function listBanks(country = "NG") {
  const query = PAYSTACK_BANK_QUERY[country.toUpperCase()];
  if (!query) return [];
  const res = await fetch(`${PAYSTACK_BASE}/bank?${query}`, {
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok || !data.status) throw new Error(data.message ?? "Failed to list banks");
  return data.data as { name: string; code: string }[];
}

// Confirms an account number actually belongs to the name on file before we
// save it — catches typos before real money gets sent to the wrong account.
export async function resolveAccountNumber(account_number: string, bank_code: string) {
  const res = await fetch(
    `${PAYSTACK_BASE}/bank/resolve?account_number=${encodeURIComponent(account_number)}&bank_code=${encodeURIComponent(bank_code)}`,
    { headers: authHeaders() }
  );
  const data = await res.json();
  if (!res.ok || !data.status) throw new Error(data.message ?? "Couldn't verify that account number");
  return data.data as { account_number: string; account_name: string };
}
