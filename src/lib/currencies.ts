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
