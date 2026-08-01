// Live currency conversion.
//
// Paystack can only charge cards in a handful of currencies (NGN, USD, GHS, ZAR, KES).
// So a Thai organizer prices in THB, but the buyer is actually charged in NGN or USD —
// converted at checkout time using a live rate. When the organizer is paid on Wednesday,
// we convert back from the settlement currency into THB for the wire transfer.
//
// Swap the provider below for whatever FX API you settle on (exchangerate.host,
// openexchangerates.org, etc.) — the rest of the app only depends on `getRate()`.

interface RateCacheEntry {
  rate: number;
  fetchedAt: number;
}
const cache = new Map<string, RateCacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — rates are "live" but don't need to hit the API every request

export async function getRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;
  const key = `${from}_${to}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rate;
  }

  const url = `https://api.exchangerate.host/live?access_key=${process.env.EXCHANGE_RATE_API_KEY}&source=${from}&currencies=${to}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  const data = await res.json();

  const quoteKey = `${from}${to}`;
  const rate = data?.quotes?.[quoteKey];
  if (!rate) {
    throw new Error(`Could not fetch FX rate ${from} -> ${to}`);
  }

  cache.set(key, { rate, fetchedAt: Date.now() });
  return rate as number;
}

// Decide what currency to actually charge the buyer in, given the event's
// native currency.
//
// Everything is charged in NGN, because that is the only currency this
// Paystack account is enabled for. USD looks like the obvious route for a Thai
// or British event, and it was what this did — but Paystack rejected every one
// of those transactions with "Currency not supported by merchant" before the
// buyer's card was ever contacted. Zero USD charges have ever succeeded here;
// every successful payment in the platform's history has been NGN.
//
// Paystack does route international cards on NGN transactions, so a foreign
// buyer can still pay — their bank converts back at its own rate. That double
// conversion is a real cost to the buyer and the reason this should revert to
// USD the day Paystack enables it on the account.
export function resolveChargeCurrency(_eventCurrency: string): "NGN" | "USD" {
  return "NGN";
}

export async function convert(amount: number, from: string, to: string) {
  const rate = await getRate(from, to);
  return { amount: Math.round(amount * rate * 100) / 100, rate };
}

// Paystack amounts are in the smallest unit (kobo / cents).
export function toSubunit(amount: number) {
  return Math.round(amount * 100);
}
export function fromSubunit(amount: number) {
  return amount / 100;
}
