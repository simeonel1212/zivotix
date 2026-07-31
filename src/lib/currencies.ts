// Every active ISO 4217 currency code, so an organizer anywhere in the world
// can price their event in their own currency. Checkout already converts
// non-NGN currencies to USD for the actual card charge (see resolveChargeCurrency
// + convert in lib/fx.ts) — this list just controls what an organizer can pick
// as their event's *pricing* currency.
export const WORLD_CURRENCIES = [
  "USD", "EUR", "GBP", "NGN", "THB", "ZAR", "KES", "GHS", "EGP", "INR",
  "CNY", "JPY", "AUD", "CAD", "CHF", "SEK", "NOK", "DKK", "PLN", "TRY",
  "BRL", "MXN", "ARS", "CLP", "COP", "PEN", "AED", "SAR", "QAR", "ILS",
  "KRW", "SGD", "HKD", "MYR", "IDR", "PHP", "VND", "PKR", "BDT", "LKR",
  "NZD", "UGX", "TZS", "RWF", "ETB", "MAD", "DZD", "TND", "XOF", "XAF",
  "CZK", "HUF", "RON", "BGN", "ISK", "UAH", "KZT", "AFN", "ALL", "AOA",
  "AMD", "AWG", "AZN", "BSD", "BHD", "BBD", "BYN", "BZD", "BMD", "BTN",
  "BOB", "BAM", "BWP", "BND", "BIF", "CVE", "KHR", "KYD", "XCD", "SVC",
  "ERN", "FJD", "GMD", "GEL", "GIP", "GTQ", "GNF", "GYD", "HTG", "HNL",
  "IRR", "IQD", "JMD", "JOD", "KWD", "KGS", "LAK", "LBP", "LSL", "LRD",
  "LYD", "MOP", "MKD", "MGA", "MWK", "MVR", "MRU", "MUR", "MDL", "MNT",
  "MZN", "MMK", "NAD", "NPR", "NIO", "OMR", "PAB", "PGK", "PYG", "RSD",
  "SCR", "SLL", "SBD", "SOS", "SSP", "SDG", "SRD", "SZL", "SYP", "TWD",
  "TJS", "TOP", "TTD", "TMT", "UYU", "UZS", "VUV", "VES", "XPF", "YER",
  "ZMW", "ZWL", "RUB", "WST", "STN",
] as const;

const displayNames = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "currency" });
  } catch {
    return null;
  }
})();

export function currencyLabel(code: string): string {
  const name = displayNames?.of(code);
  return name && name !== code ? `${code} (${name})` : code;
}

// ------------------------------------------------------------------ money
// "฿500" reads as a price. "500 THB" reads as a database row.
//
// Intl already knows every symbol, so there's no hand-written table here to go
// stale. The one thing it gets dangerously wrong for a worldwide ticketing site
// is the dollar family: narrowSymbol renders USD, AUD, CAD, SGD, HKD and NZD
// all as a bare "$", so a Sydney event would advertise "$50" and read as fifty
// US dollars. Any symbol shared by more than one currency therefore falls back
// to the disambiguated form — "A$50", "CA$50" — while unique symbols like ₦, ฿
// and ₹ stay clean.

function symbolFor(code: string, display: "narrowSymbol" | "symbol"): string {
  try {
    return (
      new Intl.NumberFormat("en-US", { style: "currency", currency: code, currencyDisplay: display })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value ?? code
    );
  } catch {
    return code;
  }
}

let sharedSymbols: Set<string> | null = null;
function isAmbiguous(code: string): boolean {
  if (!sharedSymbols) {
    const counts = new Map<string, number>();
    for (const c of WORLD_CURRENCIES) {
      const s = symbolFor(c, "narrowSymbol");
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    sharedSymbols = new Set([...counts.entries()].filter(([, n]) => n > 1).map(([s]) => s));
  }
  return sharedSymbols.has(symbolFor(code, "narrowSymbol"));
}

/**
 * A price with its currency symbol: 10000 NGN → "₦10,000", 12.5 USD → "$12.50".
 *
 * Decimals appear only when the amount actually has them — ticket prices are
 * overwhelmingly round numbers, and "₦10,000.00" is noise on every one of them.
 */
export function formatMoney(amount: number, code: string): string {
  const upper = (code ?? "").toUpperCase();
  const hasFraction = Math.abs(amount % 1) > 1e-9;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: upper,
      currencyDisplay: isAmbiguous(upper) ? "symbol" : "narrowSymbol",
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: hasFraction ? 2 : 0,
    }).format(amount);
  } catch {
    // An unknown or malformed code shouldn't blank out a price.
    return `${amount.toLocaleString()} ${upper}`;
  }
}
