import { WORLD_CURRENCIES } from "@/lib/currencies";

// Works out what currency to *show* a buyer prices in.
//
// Display only. What they're actually charged is decided server-side at
// checkout (resolveChargeCurrency + convert), and the charge currency is always
// stated before they pay. Guessing wrong here costs nothing but a slightly
// unhelpful approximation; guessing wrong about the charge would be misleading,
// which is why the two are kept separate.

const STORAGE_KEY = "zvx_display_currency";

function isSupported(code: string | null | undefined): code is string {
  return !!code && (WORLD_CURRENCIES as readonly string[]).includes(code.toUpperCase());
}

/** An explicit choice always beats a detected one. */
export function readStoredCurrency(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isSupported(stored) ? stored.toUpperCase() : null;
  } catch {
    // Private browsing and some embedded webviews throw on localStorage access.
    return null;
  }
}

export function storeCurrency(code: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, code.toUpperCase());
  } catch {
    // Not being able to remember the choice is survivable; detection still runs.
  }
}

/**
 * The currency to show approximations in.
 *
 * `detected` comes from the server (lib/geo.ts), which reads the edge network's
 * IP country. Browser locale is deliberately *not* consulted: a Nigerian laptop
 * set to English (US) reports en-US, and trusting that put "≈ USD" on naira
 * tickets for buyers standing in Lagos.
 */
export function resolveDisplayCurrency(detected: string | null): string | null {
  return readStoredCurrency() ?? (isSupported(detected) ? detected.toUpperCase() : null);
}

// Module-level cache so a page with twenty ticket prices makes one request per
// currency pair rather than twenty.
const rateCache = new Map<string, Promise<number | null>>();

export function fetchRate(from: string, to: string): Promise<number | null> {
  if (from === to) return Promise.resolve(1);
  const key = `${from}_${to}`;
  const cached = rateCache.get(key);
  if (cached) return cached;

  const promise = fetch(`/api/fx?from=${from}&to=${to}`)
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => (typeof data?.rate === "number" ? data.rate : null))
    .catch(() => null);

  rateCache.set(key, promise);
  return promise;
}

/**
 * Rounds to something a person would actually say. Sub-unit precision on a
 * converted approximation is false precision — nobody needs "≈ £12.4738".
 */
export function roundApprox(value: number): number {
  if (value >= 1000) return Math.round(value / 10) * 10;
  if (value >= 100) return Math.round(value);
  if (value >= 10) return Math.round(value * 2) / 2;
  return Math.round(value * 100) / 100;
}
