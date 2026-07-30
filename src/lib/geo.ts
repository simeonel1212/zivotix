import { headers } from "next/headers";
import { defaultPayoutCurrency, isValidCountry } from "@/lib/countries";
import { WORLD_CURRENCIES } from "@/lib/currencies";

// Where the buyer actually is, taken from the edge network rather than guessed
// from the browser.
//
// This exists because locale is not location. A Nigerian laptop set to "English
// (United States)" — which is most of them — reports en-US, and the old
// locale-based detection concluded the buyer was American and stamped "≈ 23
// USD" onto every ticket of a Lagos event priced in naira. Wrong, and noisy in
// exactly the place where noise costs a sale.
//
// Vercel sets x-vercel-ip-country on every request at the edge. Cloudflare's
// equivalent is read too so this keeps working if the site ever moves.
const COUNTRY_HEADERS = ["x-vercel-ip-country", "cf-ipcountry", "x-country-code"];

export async function buyerCountry(): Promise<string | null> {
  const h = await headers();
  for (const name of COUNTRY_HEADERS) {
    const value = h.get(name)?.trim().toUpperCase();
    // Cloudflare sends "XX" for anonymised or unknown clients.
    if (value && value !== "XX" && isValidCountry(value)) return value;
  }
  return null;
}

/**
 * The currency to *show* approximate prices in, or null to show none.
 *
 * Null is a perfectly good answer — locally, from a crawler, or behind a VPN
 * that strips the header, no approximation is better than a wrong one.
 */
export async function buyerDisplayCurrency(): Promise<string | null> {
  const country = await buyerCountry();
  if (!country) return null;
  const currency = defaultPayoutCurrency(country);
  return (WORLD_CURRENCIES as readonly string[]).includes(currency) ? currency : null;
}
