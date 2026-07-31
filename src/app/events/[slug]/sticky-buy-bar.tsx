"use client";

import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/currencies";

// A buy button that stays with you down the page.
//
// The event page is long — cover art, description, map, gallery — and the real
// ticket selector sits below all of it. On a phone that means someone reading
// about the night has no way to act on it without scrolling back, and the most
// common thing a person does when they have to hunt for a button is leave.
//
// It hides itself whenever the actual selector is on screen, watched with an
// IntersectionObserver rather than a scroll position, because the selector's
// offset changes with the description's length and whether the gallery loaded.
// Two identical buy buttons stacked on top of each other looks like a bug.
export default function StickyBuyBar({
  fromPrice,
  currency,
  isFree,
  soldOut,
  targetId,
}: {
  /** Cheapest paid ticket, or null when there's nothing priced. */
  fromPrice: number | null;
  currency: string;
  isFree: boolean;
  soldOut: boolean;
  /** Element the button scrolls to — the real ticket selector. */
  targetId: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      // A sliver of the selector counts as "on screen": by the time its top
      // edge appears the buyer has found it, and the bar should get out of the
      // way rather than sit over the thing it was pointing at.
      { threshold: 0, rootMargin: "0px 0px -120px 0px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetId]);

  if (soldOut) return null;

  function jump() {
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 px-4 pb-4 pt-3 sm:px-6 transition-[transform,opacity] duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-[130%] opacity-0"
      }`}
      // Sits above the iOS home indicator rather than under it.
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      {/* Frosted rather than a black slab: a solid dark bar reads as a browser
          chrome element bolted onto the page, while glass keeps the flyer
          visible through it and belongs to the same design as the cards. */}
      <div className="zv-glass zv-floating mx-auto flex max-w-3xl items-center justify-between gap-4 rounded-[1.5rem] px-5 py-3">
        <div className="min-w-0">
          {isFree ? (
            <p className="text-base font-bold text-emerald-600">Free entry</p>
          ) : fromPrice !== null ? (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                From
              </p>
              <p className="text-lg font-bold zv-gradient-text leading-tight">
                {formatMoney(fromPrice, currency)}
              </p>
            </>
          ) : (
            <p className="text-base font-bold text-neutral-900">Tickets</p>
          )}
        </div>
        <button onClick={jump} className="zv-btn-primary shrink-0 text-sm">
          Get tickets
        </button>
      </div>
    </div>
  );
}
