"use client";

import { useEffect, useState } from "react";
import { fetchRate, resolveDisplayCurrency, roundApprox } from "@/lib/buyer-currency";
import { formatMoney } from "@/lib/currencies";

// Shows a price in the buyer's own currency, alongside the price the organizer
// actually set.
//
// Deliberately additive: the event's own currency stays the headline and this
// appears next to it as "≈ £12". Replacing the organizer's price would be worse
// — they set it, they advertise it, and a buyer comparing the flyer to the site
// should see the same number.
//
// Renders nothing at all when the currency matches, the rate is unavailable, or
// the locale gives no useful hint. Silence is the correct failure mode for a
// convenience.
export default function ApproxPrice({
  amount,
  currency,
  detectedCurrency = null,
  className = "",
}: {
  amount: number;
  currency: string;
  /**
   * Resolved server-side from the request's IP country (lib/geo.ts). Passed in
   * rather than detected here because the browser only knows the user's
   * language, and language is not location.
   */
  detectedCurrency?: string | null;
  className?: string;
}) {
  const [display, setDisplay] = useState<{ code: string; value: number } | null>(null);

  useEffect(() => {
    if (amount <= 0) return;
    const target = resolveDisplayCurrency(detectedCurrency);
    if (!target || target === currency.toUpperCase()) return;

    let live = true;
    fetchRate(currency.toUpperCase(), target).then((rate) => {
      if (!live || !rate) return;
      setDisplay({ code: target, value: roundApprox(amount * rate) });
    });
    return () => {
      live = false;
    };
  }, [amount, currency, detectedCurrency]);

  if (!display) return null;

  return (
    <span className={`text-neutral-400 ${className}`}>
      ≈ {formatMoney(display.value, display.code)}
    </span>
  );
}
