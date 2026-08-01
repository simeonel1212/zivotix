"use client";

import { useEffect, useState } from "react";
import { fetchRate } from "@/lib/buyer-currency";
import { formatMoney } from "@/lib/currencies";

// What the card will actually be charged, shown before the buyer commits.
//
// Separate from ApproxPrice on purpose. That component is a convenience — "this
// is roughly what it costs in your money" — and it defers to whatever currency
// the buyer has chosen or been detected as. This one is a statement of fact
// about the transaction: Paystack will bill this exact figure in this exact
// currency, and it must not be overridable by a display preference.
//
// It exists because the page shows ฿535 and Paystack then shows ₦21,773. That
// jump, unexplained, is where a buyer stops and wonders whether they're being
// overcharged.
export default function ChargePreview({
  amount,
  from,
  to,
  className = "",
}: {
  amount: number;
  /** The event's own pricing currency. */
  from: string;
  /**
   * What the processor will actually bill. Required, and deliberately has no
   * default: it used to default to NGN, which was correct only while every
   * charge went to Paystack. The moment Flutterwave started taking foreign
   * currency, a default would have quietly told Thai buyers they were being
   * charged naira while their card was billed dollars.
   */
  to: string;
  className?: string;
}) {
  const [charged, setCharged] = useState<number | null>(null);

  useEffect(() => {
    if (amount <= 0 || from.toUpperCase() === to.toUpperCase()) return;
    let live = true;
    fetchRate(from.toUpperCase(), to.toUpperCase()).then((rate) => {
      if (live && rate) setCharged(Math.round(amount * rate));
    });
    return () => {
      live = false;
    };
  }, [amount, from, to]);

  // Silence beats a wrong number: if the rate can't be fetched, the buyer still
  // sees the sentence explaining they'll be charged in naira.
  if (charged === null) return null;

  return (
    <span className={className}>
      ≈ {formatMoney(charged, to)} charged
    </span>
  );
}
