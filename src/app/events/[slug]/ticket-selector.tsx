"use client";

import { useEffect, useMemo, useState } from "react";
import type { EventRow, TicketType } from "@/lib/types";

// Minimal shape of the ApplePaySession global — Safari/iOS only, everywhere
// else this is undefined and the Apple Pay button below just doesn't render.
declare global {
  interface Window {
    ApplePaySession?: { canMakePayments: () => boolean };
  }
}

export default function TicketSelector({
  event,
  ticketTypes,
}: {
  event: EventRow;
  ticketTypes: TicketType[];
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [buyer, setBuyer] = useState({ name: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applePayAvailable, setApplePayAvailable] = useState(false);

  useEffect(() => {
    // window.ApplePaySession only exists in Safari, so this genuinely can't
    // be known until after mount (SSR has no window at all) — a one-time
    // capability check on mount, not state synced from an external source.
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      setApplePayAvailable(Boolean(window.ApplePaySession?.canMakePayments()));
    } catch {
      setApplePayAvailable(false);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const total = useMemo(
    () => ticketTypes.reduce((sum, tt) => sum + (quantities[tt.id] ?? 0) * tt.price, 0),
    [quantities, ticketTypes]
  );
  const ticketCount = Object.values(quantities).reduce((a, b) => a + b, 0);
  // "total === 0" alone can't tell a genuinely free event apart from a paid
  // event with nothing selected yet — without this the page reads "Total:
  // Free / Get free tickets" on an event whose tickets cost thousands.
  const isFreeEvent = ticketTypes.length > 0 && ticketTypes.every((tt) => tt.price === 0);

  function setQty(id: string, qty: number) {
    setQuantities((q) => ({ ...q, [id]: Math.max(0, qty) }));
  }

  async function handleCheckout(provider?: "flutterwave_applepay") {
    setError(null);
    if (!buyer.name || !buyer.email) {
      setError("Enter your name and email.");
      return;
    }
    if (ticketCount === 0) {
      setError("Select at least one ticket.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          buyerName: buyer.name,
          buyerEmail: buyer.email,
          items: Object.entries(quantities)
            .filter(([, qty]) => qty > 0)
            .map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity })),
          ...(provider ? { provider } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed");
      window.location.href = data.redirectUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="zv-card p-6 sm:p-8 space-y-6">
      <h2 className="font-semibold text-lg text-neutral-900">Tickets</h2>

      <div className="space-y-3">
        {ticketTypes.map((tt) => {
          const remaining = tt.quantity_total - tt.quantity_sold;
          return (
            <div
              key={tt.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-100 bg-neutral-50/60 px-4 py-3.5"
            >
              <div>
                <p className="font-medium text-sm text-neutral-900">{tt.name}</p>
                <p className="text-sm text-neutral-500">
                  {tt.price > 0 ? `${tt.price.toLocaleString()} ${event.currency}` : (
                    <span className="font-medium text-emerald-600">Free</span>
                  )}
                  {remaining <= 10 && remaining > 0 && (
                    <span className="text-amber-600 font-medium"> · {remaining} left</span>
                  )}
                  {remaining <= 0 && <span className="text-red-500 font-medium"> · Sold out</span>}
                </p>
              </div>
              <select
                disabled={remaining <= 0}
                value={quantities[tt.id] ?? 0}
                onChange={(e) => setQty(tt.id, Number(e.target.value))}
                className="zv-input w-20 text-center disabled:opacity-40"
              >
                {Array.from({ length: Math.min(tt.max_per_order, Math.max(remaining, 0)) + 1 }, (_, n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      <div className="border-t border-neutral-100 pt-6 space-y-3">
        <input
          placeholder="Full name"
          value={buyer.name}
          onChange={(e) => setBuyer((b) => ({ ...b, name: e.target.value }))}
          className="zv-input"
        />
        <input
          placeholder="Email (your tickets are sent here)"
          type="email"
          value={buyer.email}
          onChange={(e) => setBuyer((b) => ({ ...b, email: e.target.value }))}
          className="zv-input"
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 gap-4">
        <p className="text-sm text-neutral-500">
          Total
          <br />
          <span className="text-xl font-bold text-neutral-900">
            {total > 0
              ? `${total.toLocaleString()} ${event.currency}`
              : isFreeEvent
                ? "Free"
                : "—"}
          </span>
          {total > 0 && (
            <>
              <br />
              <span className="text-xs text-neutral-400">
                {event.currency !== "NGN"
                  ? "Charged in NGN or USD at checkout, using the live rate"
                  : "Charged in NGN"}
              </span>
            </>
          )}
        </p>
        <div className="flex flex-col gap-2 w-full sm:w-auto">
          <button onClick={() => handleCheckout()} disabled={loading || ticketCount === 0} className="zv-btn-primary shrink-0 w-full sm:w-auto">
            {loading ? (
              "Getting your tickets…"
            ) : ticketCount === 0 ? (
              "Select tickets"
            ) : total > 0 ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" aria-hidden="true">
                  <path
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 2.3c-.6.6-.2 1.7.7 1.7H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Checkout
              </>
            ) : (
              "Get free tickets"
            )}
          </button>
          {applePayAvailable && total > 0 && (
            <button
              onClick={() => handleCheckout("flutterwave_applepay")}
              disabled={loading || ticketCount === 0}
              className="rounded-full bg-black text-white text-sm font-semibold py-3 px-6 w-full sm:w-auto transition-opacity hover:opacity-85 disabled:opacity-40"
            >
              Pay with Apple Pay
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <p className="text-xs text-neutral-400">
        By checking out, you agree to our{" "}
        <a href="/terms" className="underline hover:text-neutral-600">
          Terms
        </a>{" "}
        and{" "}
        <a href="/refund-policy" className="underline hover:text-neutral-600">
          Refund Policy
        </a>
        .
      </p>
    </div>
  );
}
