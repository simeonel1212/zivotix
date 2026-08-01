"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Your name, and the name buyers see.
//
// Two fields that look similar and are not. full_name is the person — it goes
// on nothing public. business_name is the brand, and it appears on every event
// page, every ticket and every confirmation email that has already been sent.
// Renaming it is allowed and sometimes necessary, but it is worth saying out
// loud on the form rather than discovering it afterwards.
export default function ProfileForm({
  organizerId,
  profileId,
  fullName,
  businessName,
}: {
  organizerId: string;
  profileId: string;
  fullName: string;
  businessName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(fullName);
  const [brand, setBrand] = useState(businessName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = name.trim() !== fullName || brand.trim() !== businessName;

  async function save() {
    setError(null);
    if (!brand.trim()) {
      setError("A brand name is required — it's what buyers see on your events.");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    // Two tables, and no transaction across them from the browser. The brand
    // goes first because it is the one that matters publicly: if the second
    // write fails, an organizer with a stale personal name is a much smaller
    // problem than an event page showing the wrong brand.
    const { error: orgError } = await supabase
      .from("organizers")
      .update({ business_name: brand.trim() })
      .eq("id", organizerId);

    if (orgError) {
      setSaving(false);
      setError(orgError.message);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: name.trim() || null })
      .eq("id", profileId);

    setSaving(false);
    if (profileError) {
      setError(`Brand name saved, but your name didn't: ${profileError.message}`);
      return;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    router.refresh();
  }

  return (
    <div className="zv-card p-6 space-y-4">
      <div>
        <h2 className="font-semibold text-neutral-50">Your details</h2>
        <p className="text-sm text-neutral-400 mt-1">
          Your name is private. Your brand name is public.
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm text-neutral-300">Your name</span>
        <input
          className="zv-input"
          placeholder="Daysun Simeon"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm text-neutral-300">Brand name</span>
        <input
          className="zv-input"
          placeholder="Afrophuket"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        />
        <span className="block text-xs text-neutral-500">
          Shown on your event pages, tickets and emails. Changing it updates them everywhere,
          including tickets already sold.
        </span>
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        onClick={save}
        disabled={saving || !dirty}
        className="zv-btn-secondary text-sm disabled:opacity-40"
      >
        {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
      </button>
    </div>
  );
}
