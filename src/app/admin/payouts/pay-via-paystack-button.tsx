"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PayViaPaystackButton({ payoutId }: { payoutId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function pay() {
    setLoading(true);
    setMessage(null);
    const res = await fetch(`/api/admin/payouts/${payoutId}/pay`, { method: "POST" });
    const data = await res.json();
    setLoading(false);
    setConfirming(false);
    if (!res.ok) {
      setMessage(data.error);
      return;
    }
    if (data.message) setMessage(data.message);
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-500">Send this transfer for real?</span>
        <button onClick={pay} disabled={loading} className="zv-btn-primary text-xs px-3 py-1.5 disabled:opacity-40">
          {loading ? "Sending…" : "Confirm"}
        </button>
        <button onClick={() => setConfirming(false)} className="text-xs text-neutral-400 hover:text-neutral-600">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => setConfirming(true)}
        className="zv-badge bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
      >
        Pay via Paystack
      </button>
      {message && <p className="text-xs text-amber-600 max-w-xs text-right">{message}</p>}
    </div>
  );
}
