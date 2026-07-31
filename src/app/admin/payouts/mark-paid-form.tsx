"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function MarkPaidForm({ payoutId }: { payoutId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="zv-badge bg-white/[0.08] text-neutral-300 hover:bg-white/[0.14] transition-colors">
        Mark paid
      </button>
    );
  }

  async function submit() {
    setLoading(true);
    await fetch(`/api/admin/payouts/${payoutId}/mark-paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <input
        placeholder="Transfer reference"
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        className="zv-input text-xs px-3 py-1.5 w-32"
      />
      <button onClick={submit} disabled={loading} className="zv-btn-primary text-xs px-3 py-1.5 disabled:opacity-40">
        Confirm
      </button>
    </div>
  );
}
