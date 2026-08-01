"use client";

import { useEffect, useState } from "react";
import { fetchRate } from "@/lib/buyer-currency";
import { formatMoney } from "@/lib/currencies";

// The amount the card will actually be billed, shown next to the total.
//
// One number, and it is not an approximation of a convenience — it is the
// figure the processor charges. That distinction is why this takes `to` as a
// required prop resolved server-side by the payment router, rather than
// guessing from the buyer's location. An earlier version of this component
// defaulted to NGN and a sibling guessed from the viewer's IP; between them a
// Thai event could show a naira figure to a Nigerian viewer while billing
// dollars. Both are gone.
//
// Renders nothing if the rate can't be fetched. Silence beats a wrong number
// on a page where the next click spends money.
export default function ChargePreview({
  amount,
  from,
  to,
  className = "",
}: {
  /** Total in the event's own currency, fee included. */
  amount: number;
  /** The currency the organizer priced in. */
  from: string;
  /** What the processor bills — from resolvePaymentRoute(), server-side. */
  to: string;
  className?: string;
}) {
  const [charged, setCharged] = useState<number | null>(null);

  const same = from.toUpperCase() === to.toUpperCase();

  useEffect(() => {
    if (amount <= 0 || same) return;
    let live = true;
    fetchRate(from.toUpperCase(), to.toUpperCase()).then((rate) => {
      if (live && rate) setCharged(Math.round(amount * rate * 100) / 100);
    });
    return () => {
      live = false;
    };
  }, [amount, from, to, same]);

  if (same || charged === null) return null;

  return <span className={className}>≈ {formatMoney(charged, to)}</span>;
}
