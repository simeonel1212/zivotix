"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { EventRow, TicketType } from "@/lib/types";
import { computeFees, type FeeMode } from "@/lib/fees";
import { formatMoney } from "@/lib/currencies";

// Checkout is a single button. Paystack's hosted page presents card and
// Apple Pay itself (both approved on this account), so there's no separate
// wallet button here and no browser capability sniffing — Paystack shows
// Apple Pay only to devices that can actually use it.
export default function TicketSelector({
  event,
  ticketTypes,
  feeMode = "pass",
}: {
  event: EventRow;
  ticketTypes: TicketType[];
  /** "absorb" means the organizer covers the fee and the buyer pays the listed price flat. */
  feeMode?: FeeMode;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [buyer, setBuyer] = useState({ name: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = useMemo(
    () => ticketTypes.reduce((sum, tt) => sum + (quantities[tt.id] ?? 0) * tt.price, 0),
    [quantities, ticketTypes]
  );
  // Shown itemised before checkout rather than sprung on the buyer at the
  // payment page — a fee that appears only after they've committed is the
  // single most common complaint about ticketing sites.
  const fees = useMemo(
    () => computeFees(subtotal, event.currency, feeMode),
    [subtotal, event.currency, feeMode]
  );
  const total = fees.total;
  const ticketCount = Object.values(quantities).reduce((a, b) => a + b, 0);
  // "total === 0" alone can't tell a genuinely free event apart from a paid
  // event with nothing selected yet — without this the page reads "Total:
  // Free / Get free tickets" on an event whose tickets cost thousands.
  const isFreeEvent = ticketTypes.length > 0 && ticketTypes.every((tt) => tt.price === 0);

  // Tiers bucketed under their category heading, in the order the categories
  // first appear (which is the organizer's own price ordering, not alphabetical
  // — "Standing" before "Tables" is their call to make, not ours).
  //
  // A null category is its own bucket with no heading, so an organizer who
  // never touches this feature sees exactly the flat list they had before.
  // Matching is case- and whitespace-insensitive: "Tables", "tables" and
  // "Tables " are one group, not three. An organizer typing the same word twice
  // means the same thing, and splitting their section in half over a capital
  // letter would look like a bug on their public page.
  //
  // The heading shown is whichever spelling appeared first, so their own
  // capitalisation is preserved rather than lowercased into something they
  // didn't write.
  const groups = useMemo(() => {
    const byKey = new Map<string, { label: string | null; tiers: TicketType[] }>();
    for (const tt of ticketTypes) {
      const raw = tt.category?.trim().replace(/\s+/g, " ") ?? "";
      const key = raw.toLowerCase();
      const existing = byKey.get(key);
      if (existing) existing.tiers.push(tt);
      else byKey.set(key, { label: raw || null, tiers: [tt] });
    }
    return [...byKey.entries()].map(([key, g]) => ({ key, ...g }));
  }, [ticketTypes]);

  // Collapsed groups, tracked by category name.
  //
  // Everything starts open. A category a buyer has to click before they can see
  // a price is a price they might never see, and the whole point of the section
  // is to sell what's in it. Collapsing is there for the organizer running eight
  // tiers across three groups, as a way to get past what you're not buying.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  function toggleGroup(category: string) {
    setCollapsed((c) => ({ ...c, [category]: !c[category] }));
  }

  function setQty(id: string, qty: number) {
    setQuantities((q) => ({ ...q, [id]: Math.max(0, qty) }));
  }

  async function handleCheckout() {
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
      <h2 className="font-semibold text-lg text-neutral-50">Tickets</h2>

      <div className="space-y-6">
        {groups.map(({ key, label, tiers }) => {
          const isOpen = !label || !collapsed[key];
          const selectedInGroup = tiers.reduce((n, tt) => n + (quantities[tt.id] ?? 0), 0);
          return (
          <div key={key || "__ungrouped"} className="space-y-3">
            {label && (
              <button
                type="button"
                onClick={() => toggleGroup(key)}
                aria-expanded={isOpen}
                className="flex items-center gap-2 w-full text-left group/cat"
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 group-hover/cat:text-neutral-300 transition-colors">
                  {label}
                </span>
                <span className="text-xs text-neutral-600">{tiers.length}</span>
                {/* A collapsed group holding a selected ticket would otherwise
                    look empty while still being charged for. */}
                {!isOpen && selectedInGroup > 0 && (
                  <span className="zv-badge bg-white text-neutral-900 text-[10px] px-2 py-0.5">
                    {selectedInGroup} selected
                  </span>
                )}
                <span className="flex-1 h-px bg-white/[0.08]" />
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`h-3.5 w-3.5 text-neutral-500 transition-transform ${isOpen ? "" : "-rotate-90"}`}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            )}
            {isOpen && tiers.map((tt) => {
              const remaining = tt.quantity_total - tt.quantity_sold;
              return (
                <div
                  key={tt.id}
                  // items-start, not items-center: with a few lines of
                  // description the quantity box would otherwise float to the
                  // middle of the card, away from the ticket it belongs to.
                  className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-neutral-50">{tt.name}</p>
                    {/* whitespace-pre-wrap keeps the organizer's own line
                        breaks, and the leading gives multi-line copy room to
                        read as separate points rather than one block of text
                        running into the price underneath it. */}
                    {tt.description && (
                      <p className="text-xs text-neutral-400 mt-1 mb-1.5 leading-relaxed whitespace-pre-wrap">
                        {tt.description}
                      </p>
                    )}
                    {/* Just the price. The approximate conversion and the
                        remaining-stock count both used to live here; repeated
                        down a list of five tiers they were noise, and a
                        scarcity number on every row reads as pressure rather
                        than information. Sold out stays — a buyer has to know
                        they can't have it. */}
                    {/* The price carries the brand gradient so it separates
                        from the grey description above it at a glance — on a
                        tier with three lines of copy, a same-coloured price
                        just reads as one more line of text. */}
                    <p className="text-sm mt-0.5">
                      {tt.price > 0 ? (
                        <span className="font-bold zv-gradient-text">
                          {formatMoney(tt.price, event.currency)}
                        </span>
                      ) : (
                        <span className="font-bold text-emerald-400">Free</span>
                      )}
                      {remaining <= 0 && <span className="text-red-400 font-medium"> · Sold out</span>}
                    </p>
                  </div>
                  <select
                    disabled={remaining <= 0}
                    value={quantities[tt.id] ?? 0}
                    onChange={(e) => setQty(tt.id, Number(e.target.value))}
                    className="zv-input w-20 text-center disabled:opacity-40 shrink-0"
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
          );
        })}
      </div>

      <div className="border-t border-white/10 pt-6 space-y-3">
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

      {/* Only itemised when the buyer is actually paying it. Under "absorb"
          the fee is the organizer's cost, and showing a buyer a line item
          they aren't being charged would just be confusing. */}
      {subtotal > 0 && fees.mode === "pass" && (
        <div className="rounded-2xl bg-white/[0.04] border border-white/10 px-4 py-3 space-y-1.5 text-sm">
          <div className="flex justify-between text-neutral-400">
            <span>Tickets</span>
            <span className="tabular-nums">
              {formatMoney(subtotal, event.currency)}
            </span>
          </div>
          <div className="flex justify-between text-neutral-400">
            <span>Service fee</span>
            <span className="tabular-nums">
              {formatMoney(fees.serviceFee, event.currency)}
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 gap-4">
        <p className="text-sm text-neutral-400">
          Total
          <br />
          <span className="text-xl font-bold text-neutral-50">
            {total > 0
              ? formatMoney(total, event.currency)
              : isFreeEvent
                ? "Free"
                : "—"}
          </span>
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
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <p className="text-xs text-neutral-500">
        By checking out, you agree to our{" "}
        <Link href="/terms" className="underline hover:text-neutral-300">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/refund-policy" className="underline hover:text-neutral-300">
          Refund Policy
        </Link>
        .
      </p>
    </div>
  );
}
