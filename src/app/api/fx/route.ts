import { NextResponse } from "next/server";
import { getRate } from "@/lib/fx";
import { WORLD_CURRENCIES } from "@/lib/currencies";

// Exchange rate lookup for the browser.
//
// Proxied rather than called from the client because the FX provider needs an
// API key, and because caching server-side means one upstream request serves
// every visitor rather than one per person.
//
// This is display only. What the buyer is actually charged is decided at
// checkout by resolveChargeCurrency + convert, server-side, at that moment.
// A rate shown here is explicitly an approximation and labelled as one.

export const revalidate = 600; // ten minutes — rates move slowly enough

function isSupported(code: string): boolean {
  return (WORLD_CURRENCIES as readonly string[]).includes(code);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = (searchParams.get("from") ?? "").toUpperCase();
  const to = (searchParams.get("to") ?? "").toUpperCase();

  // Validated against the known list so this can't be used to fan arbitrary
  // strings out to the upstream provider.
  if (!isSupported(from) || !isSupported(to)) {
    return NextResponse.json({ error: "Unsupported currency" }, { status: 400 });
  }

  if (from === to) return NextResponse.json({ rate: 1 });

  try {
    const rate = await getRate(from, to);
    return NextResponse.json({ rate });
  } catch {
    // A missing rate is not an error worth surfacing to a buyer — the page
    // simply shows the original price with no approximation.
    return NextResponse.json({ error: "Rate unavailable" }, { status: 502 });
  }
}
