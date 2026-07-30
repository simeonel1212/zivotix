// Countries, and how an organizer in each one gets paid.
//
// Organizers may sign up from anywhere. What changes by country is the payout
// rail, not eligibility:
//
//   Paystack transfer — Nigeria, Ghana, South Africa, Kenya. Automated, fast,
//                       low fee. These are the markets Paystack settles into.
//   Manual wire       — everywhere else, exactly as Thailand has worked from
//                       the start. Slower, carries bank and intermediary fees,
//                       but it works anywhere with a bank account.
//
// Buyers were never limited by this. They pay by card or Apple Pay from any
// country, and always have.

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return null;
  }
})();

export function countryLabel(code: string): string {
  if (!code) return "";
  return regionNames?.of(code.toUpperCase()) ?? code.toUpperCase();
}

// Rough flag emoji from a country code — each letter maps to a regional
// indicator symbol. Falls back to an empty string on anything malformed.
export function countryFlag(code: string): string {
  if (!code || code.length !== 2) return "";
  const base = 0x1f1e6;
  const upper = code.toUpperCase();
  return String.fromCodePoint(
    base + upper.charCodeAt(0) - 65,
    base + upper.charCodeAt(1) - 65
  );
}

/** Countries Paystack can transfer into directly. Everywhere else is wire. */
export const PAYSTACK_TRANSFER_COUNTRIES = ["NG", "GH", "ZA", "KE"] as const;

export type PayoutMethod = "paystack" | "wire";

export function payoutMethod(country: string): PayoutMethod {
  return (PAYSTACK_TRANSFER_COUNTRIES as readonly string[]).includes(country?.toUpperCase())
    ? "paystack"
    : "wire";
}

export function payoutMethodLabel(country: string): string {
  return payoutMethod(country) === "paystack"
    ? "Paid by bank transfer, usually the same day"
    : "Paid by international transfer, 1–3 business days";
}

// Default payout currency per country. Only the ones we're realistically going
// to see are listed — anything missing falls back to USD, which an organizer can
// change, and which is the currency a wire would settle in anyway.
const DEFAULT_CURRENCY: Record<string, string> = {
  NG: "NGN", TH: "THB", GH: "GHS", ZA: "ZAR", KE: "KES", UG: "UGX", TZ: "TZS",
  RW: "RWF", ET: "ETB", EG: "EGP", MA: "MAD", SN: "XOF", CI: "XOF", CM: "XAF",
  GB: "GBP", IE: "EUR", FR: "EUR", DE: "EUR", ES: "EUR", IT: "EUR", NL: "EUR",
  PT: "EUR", BE: "EUR", AT: "EUR", GR: "EUR", FI: "EUR", US: "USD", CA: "CAD",
  MX: "MXN", BR: "BRL", AR: "ARS", AE: "AED", SA: "SAR", QA: "QAR", IL: "ILS",
  TR: "TRY", IN: "INR", PK: "PKR", BD: "BDT", LK: "LKR", CN: "CNY", JP: "JPY",
  KR: "KRW", SG: "SGD", MY: "MYR", ID: "IDR", PH: "PHP", VN: "VND", HK: "HKD",
  TW: "TWD", AU: "AUD", NZ: "NZD", CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK",
  PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", UA: "UAH",
};

export function defaultPayoutCurrency(country: string): string {
  return DEFAULT_CURRENCY[country?.toUpperCase()] ?? "USD";
}

// ISO 3166-1 alpha-2. Names come from Intl at runtime rather than being stored
// here, so they're localised and never go stale.
export const ISO_COUNTRIES = [
  "AD","AE","AF","AG","AL","AM","AO","AR","AT","AU","AW","AZ","BA","BB","BD","BE",
  "BF","BG","BH","BI","BJ","BN","BO","BR","BS","BT","BW","BY","BZ","CA","CD","CF",
  "CG","CH","CI","CL","CM","CN","CO","CR","CU","CV","CY","CZ","DE","DJ","DK","DM",
  "DO","DZ","EC","EE","EG","ER","ES","ET","FI","FJ","FM","FR","GA","GB","GD","GE",
  "GH","GM","GN","GQ","GR","GT","GW","GY","HK","HN","HR","HT","HU","ID","IE","IL",
  "IN","IQ","IR","IS","IT","JM","JO","JP","KE","KG","KH","KI","KM","KN","KR","KW",
  "KZ","LA","LB","LC","LI","LK","LR","LS","LT","LU","LV","LY","MA","MC","MD","ME",
  "MG","MH","MK","ML","MM","MN","MR","MT","MU","MV","MW","MX","MY","MZ","NA","NE",
  "NG","NI","NL","NO","NP","NR","NZ","OM","PA","PE","PG","PH","PK","PL","PS","PT",
  "PW","PY","QA","RO","RS","RU","RW","SA","SB","SC","SD","SE","SG","SI","SK","SL",
  "SM","SN","SO","SR","SS","ST","SV","SY","SZ","TD","TG","TH","TJ","TL","TM","TN",
  "TO","TR","TT","TV","TW","TZ","UA","UG","US","UY","UZ","VC","VE","VN","VU","WS",
  "YE","ZA","ZM","ZW",
] as const;

export function isValidCountry(code: unknown): code is string {
  return (
    typeof code === "string" &&
    (ISO_COUNTRIES as readonly string[]).includes(code.toUpperCase())
  );
}

export interface CountryOption {
  code: string;
  name: string;
  flag: string;
  method: PayoutMethod;
}

/**
 * Every country, alphabetical by name, with the Paystack-transfer ones first —
 * an organizer in Lagos or Nairobi shouldn't have to scroll past 200 entries to
 * find themselves.
 */
export function countryOptions(): CountryOption[] {
  const all = ISO_COUNTRIES.map((code) => ({
    code,
    name: countryLabel(code),
    flag: countryFlag(code),
    method: payoutMethod(code),
  })).sort((a, b) => a.name.localeCompare(b.name));

  const priority = all.filter((c) => c.method === "paystack");
  const rest = all.filter((c) => c.method !== "paystack");
  return [...priority, ...rest];
}
