// Country names from ISO codes.
//
// Events currently carry an `org_country` of NG or TH, because those are the
// only places Zivotix can pay an organizer out to. Buyers are not limited that
// way — anyone with a card or Apple Pay can buy, and an event can be priced in
// any of the currencies in lib/currencies.ts.
//
// This resolves any ISO 3166-1 alpha-2 code rather than hard-coding the two we
// support today, so adding a payout country later needs no change here.
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
