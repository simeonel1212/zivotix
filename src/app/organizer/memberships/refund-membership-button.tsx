"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Refunds a pass in full and voids it immediately.
//
// The confirm names the consequence rather than asking "are you sure?" — the
// member loses their remaining entries and gets all their money back, including
// nights they already attended. That's the trade, and the organizer should read
// it before clicking.
export default function RefundMembershipButton({
  membershipId,
  memberName,
  amount,
  currency,
  creditsUsed,
}: {
  membershipId: string;
  memberName: string;
  amount: number;
  currency: string;
  creditsUsed: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refund() {
    const used =
      creditsUsed > 0
        ? ` They've already used ${creditsUsed} ${creditsUsed === 1 ? "entry" : "entries"}, and you're refunding those too.`
        : "";
    if (
      !confirm(
        `Refund ${memberName} the full ${amount.toLocaleString()} ${currency}?${used} Their pass stops working immediately.`
      )
    )
      return;

    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/memberships/${membershipId}/refund`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Refund failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refund failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-right">
      <button
        onClick={refund}
        disabled={loading}
        className="text-xs font-medium text-neutral-500 hover:text-red-400 transition-colors disabled:opacity-40"
      >
        {loading ? "Refunding…" : "Refund"}
      </button>
      {error && <p className="text-[11px] text-red-400 mt-1 max-w-[14rem]">{error}</p>}
    </div>
  );
}
