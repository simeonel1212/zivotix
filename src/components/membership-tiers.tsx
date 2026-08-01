"use client";

import { useState } from "react";
import { computeFees } from "@/lib/fees";
import { formatMoney } from "@/lib/currencies";
import ChargePreview from "@/components/charge-preview";
import { membershipShapeLabel } from "@/lib/memberships";
import type { MembershipTier } from "@/lib/types";

// Passes for sale on an organizer's public page.
//
// Shown above their events on purpose: a pass is the higher-value purchase and
// the one that turns a one-off buyer into a regular. Someone who came for a
// single night should see the season option before they decide.
export default function MembershipTiers({
  tiers,
  chargeCurrencies = {},
}: {
  tiers: MembershipTier[];
  /** Tier currency → what the card is billed in, decided server-side. */
  chargeCurrencies?: Record<string, string>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [buyer, setBuyer] = useState({ name: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!tiers.length) return null;

  async function buy(tierId: string) {
    setError(null);
    if (!buyer.name.trim() || !buyer.email.trim()) {
      setError("Enter your name and email.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/memberships/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId, memberName: buyer.name, memberEmail: buyer.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start that purchase");
      // assign() rather than setting location.href: same effect, but the lint
      // rule against mutating values defined outside the component is a fair
      // one and this is the idiomatic way to satisfy it.
      window.location.assign(data.redirectUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-neutral-50">Become a member</h2>
        <p className="text-sm text-neutral-400 mt-1">
          Pay once. Walk in whenever they&apos;re on.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {tiers.map((tier) => {
          const fees = computeFees(tier.price, tier.currency, "pass");
          // Only meaningful on a punch card; a period pass has no per-entry price.
          const perEntry =
            tier.event_credits && tier.event_credits > 0
              ? Math.round((tier.price / tier.event_credits) * 100) / 100
              : null;
          const open = openId === tier.id;

          return (
            <div key={tier.id} className="zv-card p-5 flex flex-col">
              <p className="font-semibold text-neutral-50">{tier.name}</p>
              {tier.description && (
                <p className="mt-1.5 text-sm text-neutral-400 leading-relaxed">{tier.description}</p>
              )}

              <div className="mt-4">
                <p className="text-2xl font-bold text-neutral-50">
                  {formatMoney(fees.total, tier.currency)}
                </p>
                <ChargePreview
                  amount={fees.total}
                  from={tier.currency}
                  to={chargeCurrencies[tier.currency] ?? tier.currency}
                  className="block text-xs text-neutral-500"
                />
                <p className="mt-1 text-sm text-neutral-400">
                  {membershipShapeLabel(tier)}
                  {perEntry !== null && ` · ${formatMoney(perEntry, tier.currency)} a night`}
                </p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {tier.kind === "period"
                    ? "Come to everything while it's running"
                    : `Use them any time in the next ${Math.round(tier.validity_days / 30)} months`}
                </p>
              </div>

              {open ? (
                <div className="mt-4 space-y-2">
                  <input
                    placeholder="Full name"
                    className="zv-input text-sm"
                    value={buyer.name}
                    onChange={(e) => setBuyer((b) => ({ ...b, name: e.target.value }))}
                  />
                  <input
                    placeholder="Email (your pass is sent here)"
                    type="email"
                    className="zv-input text-sm"
                    value={buyer.email}
                    onChange={(e) => setBuyer((b) => ({ ...b, email: e.target.value }))}
                  />
                  {error && <p className="text-xs text-red-400">{error}</p>}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => buy(tier.id)}
                      disabled={loading}
                      className="zv-btn-primary text-sm w-full sm:w-auto"
                    >
                      {loading ? "Taking you to pay…" : "Buy pass"}
                    </button>
                    <button
                      onClick={() => setOpenId(null)}
                      className="text-sm text-neutral-500 hover:text-neutral-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setOpenId(tier.id);
                    setError(null);
                  }}
                  className="zv-btn-secondary text-sm mt-4 w-full"
                >
                  Get this pass
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
