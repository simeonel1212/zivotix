"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Marks a merch order handed over or posted.
//
// One tap, no confirmation: the cost of a mis-tap is a row leaving a to-do
// list, which the organizer can see and correct, and demanding a confirmation
// on every parcel would make posting twenty orders twenty dialogs.
export default function FulfilButton({ orderId, label }: { orderId: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function mark() {
    setBusy(true);
    setError(false);
    const { error: updateError } = await createClient()
      .from("merch_orders")
      .update({ fulfilled_at: new Date().toISOString() })
      .eq("id", orderId);
    setBusy(false);
    if (updateError) {
      setError(true);
      return;
    }
    router.refresh();
  }

  return (
    <button
      onClick={mark}
      disabled={busy}
      className="zv-badge bg-white/[0.08] text-neutral-200 hover:bg-white/[0.14] transition-colors disabled:opacity-40 shrink-0"
    >
      {busy ? "Saving…" : error ? "Try again" : label}
    </button>
  );
}
