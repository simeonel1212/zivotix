"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RefundButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refund() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/orders/${orderId}/refund`, { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setConfirming(false);
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">Refund this order?</span>
          <button onClick={refund} disabled={loading} className="zv-badge bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-40">
            {loading ? "Refunding…" : "Confirm"}
          </button>
          <button onClick={() => setConfirming(false)} className="text-xs text-neutral-400 hover:text-neutral-600">
            Cancel
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="zv-badge bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-colors"
    >
      Refund
    </button>
  );
}
