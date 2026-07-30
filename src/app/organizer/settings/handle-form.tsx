"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normaliseHandle, validateHandle } from "@/lib/handles";

// Claims a vanity URL — zivotix.site/eden.
//
// Shown as a live preview rather than a form field alone, because the thing an
// organizer is actually choosing is the link they'll put in their bio, and they
// should see it exactly as it will appear.
export default function HandleForm({
  organizerId,
  current,
}: {
  organizerId: string;
  current: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = normaliseHandle(value);
  const check = handle ? validateHandle(handle) : { ok: false as const };

  async function save() {
    setError(null);
    if (!check.ok) {
      setError(check.error ?? "Pick a handle.");
      return;
    }
    setSaving(true);
    const { error: updateError } = await createClient()
      .from("organizers")
      .update({ handle })
      .eq("id", organizerId);
    setSaving(false);

    if (updateError) {
      // A unique-violation here means someone else got there first, which is
      // worth saying plainly rather than showing a Postgres error.
      setError(
        updateError.code === "23505"
          ? "Someone already has that one. Try another."
          : updateError.message
      );
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    router.refresh();
  }

  return (
    <div className="zv-card p-6 space-y-4">
      <div>
        <h2 className="font-semibold text-neutral-900">Your Zivotix link</h2>
        <p className="text-sm text-neutral-500 mt-1">
          A short link for your bio and your flyers. Your old link keeps working.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex items-center gap-0 flex-1 rounded-2xl border border-neutral-200 bg-white overflow-hidden">
          <span className="pl-4 pr-1 text-sm text-neutral-400 select-none">zivotix.site/</span>
          <input
            className="flex-1 py-3 pr-4 text-sm text-neutral-900 outline-none"
            placeholder="eden"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
          />
        </div>
        <button
          onClick={save}
          disabled={saving || !check.ok || handle === current}
          className="zv-btn-secondary text-sm shrink-0 disabled:opacity-40"
        >
          {saving ? "Saving…" : saved ? "Saved" : "Claim"}
        </button>
      </div>

      {handle && handle !== value.trim().toLowerCase() && (
        <p className="text-xs text-neutral-400">
          Will be saved as <strong className="text-neutral-600">zivotix.site/{handle}</strong>
        </p>
      )}
      {handle && !check.ok && check.error && <p className="text-xs text-amber-600">{check.error}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {current && (
        <p className="text-xs text-neutral-400">
          Live at <strong className="text-neutral-600">zivotix.site/{current}</strong>
        </p>
      )}
    </div>
  );
}
