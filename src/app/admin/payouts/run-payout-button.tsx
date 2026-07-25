"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RunPayoutButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    await fetch("/api/admin/payouts/run", { method: "POST" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button onClick={run} disabled={disabled || loading} className="zv-btn-primary disabled:opacity-40">
      {loading ? "Running…" : "Run payout"}
    </button>
  );
}
