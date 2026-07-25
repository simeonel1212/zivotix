"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Lets an admin set a per-organizer commission rate without touching SQL.
// Stored as a fraction (0.10 = 10%) but entered as a percentage, since that's
// how the rate actually gets discussed with an organizer.
//
// The floor exists because Zivotix pays the Paystack/Flutterwave fee out of
// its own cut: Flutterwave takes a flat 4.8% on Apple Pay, so a commission
// below that means paying an organizer more than the sale actually brought
// in. See src/lib/processor-fees.ts.
const PROCESSOR_FLOOR_PERCENT = 4.8;

export default function CommissionRateForm({
  organizerId,
  rate,
  isPlatformOwn,
}: {
  organizerId: string;
  rate: number;
  isPlatformOwn: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState((rate * 100).toFixed(1).replace(/\.0$/, ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const parsed = Number(value);
  const dirty = Math.abs(parsed / 100 - rate) > 1e-9;
  const belowFloor = Number.isFinite(parsed) && parsed > 0 && parsed < PROCESSOR_FLOOR_PERCENT;

  async function save() {
    setError(null);
    setSaved(false);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      setError("Enter a percentage between 0 and 100.");
      return;
    }
    setSaving(true);
    const { error: updateError } = await createClient()
      .from("organizers")
      .update({ commission_rate: parsed / 100 })
      .eq("id", organizerId);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  if (isPlatformOwn) {
    return <span className="text-xs text-neutral-400">0% (own event)</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          inputMode="decimal"
          aria-label="Commission rate percentage"
          className="zv-input w-16 text-center text-xs py-1.5 px-2"
        />
        <span className="text-xs text-neutral-400">%</span>
        {dirty && (
          <button
            onClick={save}
            disabled={saving}
            className="zv-badge bg-neutral-900 text-white hover:bg-neutral-700 transition-colors disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        )}
        {saved && !dirty && <span className="text-xs text-emerald-600">Saved</span>}
      </div>
      {belowFloor && (
        <p className="text-xs text-amber-600 max-w-[15rem] text-right">
          Below {PROCESSOR_FLOOR_PERCENT}%, an Apple Pay sale can cost you more than it earns.
        </p>
      )}
      {error && <p className="text-xs text-red-600 max-w-[15rem] text-right">{error}</p>}
    </div>
  );
}
