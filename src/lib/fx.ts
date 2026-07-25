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
// Everything now goes through Paystack, which handles cards (local and
// international) and Apple Pay on this account. NGN events are charged in
// NGN: it's the buyer's own currency, and Paystack's local card rate is 1.5%
// versus 3.9% international, so converting would cost both sides more.
// Paystack can't charge a card in THB, so everything else routes via USD.
export function resolveChargeCurrency(eventCurrency: string): "NGN" | "USD" {
  if (eventCurrency === "NGN") return "NGN";
  return "USD"; // THB (and anything else) routes through USD
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
