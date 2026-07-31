"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { MembershipTier } from "@/lib/types";
import TierForm from "./tier-form";

// One pass in the organizer's list, with the two controls they actually need:
// change it, or stop selling it.
//
// "Take off sale" is separate from editing on purpose. It's the urgent action —
// an organizer who has oversold or priced wrongly wants it gone from the public
// page in one click, not buried behind a form. It flips is_active, which is the
// same flag the public read policy filters on, so the pass disappears from the
// community page and the event upsell immediately while existing members keep
// theirs.
export default function TierRow({
  tier,
  organizerId,
  memberCount,
}: {
  tier: MembershipTier;
  organizerId: string;
  memberCount: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleActive() {
    setBusy(true);
    await createClient()
      .from("membership_tiers")
      .update({ is_active: !tier.is_active })
      .eq("id", tier.id);
    setBusy(false);
    router.refresh();
  }

  if (editing) {
    return (
      <li>
        <TierForm
          organizerId={organizerId}
          defaultCurrency={tier.currency}
          tier={tier}
          memberCount={memberCount}
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="zv-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-semibold text-neutral-50">{tier.name}</p>
          {tier.description && (
            <p className="text-sm text-neutral-400 mt-1 line-clamp-2">{tier.description}</p>
          )}
          <p className="text-xs text-neutral-500 mt-2">
            {tier.event_credits} {tier.event_credits === 1 ? "entry" : "entries"} · valid{" "}
            {Math.round(tier.validity_days / 30)} months
            {memberCount > 0 &&
              ` · ${memberCount} ${memberCount === 1 ? "member" : "members"}`}
            {!tier.is_active && " · not on sale"}
          </p>
        </div>
        <p className="font-semibold text-neutral-50 whitespace-nowrap">
          {tier.price.toLocaleString()} {tier.currency}
        </p>
      </div>

      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/10">
        <button
          onClick={() => setEditing(true)}
          className="text-sm font-semibold zv-gradient-text"
        >
          Edit
        </button>
        <button
          onClick={toggleActive}
          disabled={busy}
          className="text-sm text-neutral-500 hover:text-neutral-200 disabled:opacity-40"
        >
          {busy ? "Saving…" : tier.is_active ? "Take off sale" : "Put back on sale"}
        </button>
      </div>
    </li>
  );
}
