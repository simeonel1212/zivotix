"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Changing the address you sign in with.
//
// Supabase does not swap the address when this is submitted — it sends a
// confirmation link to the new one and only switches once that link is opened.
// That is the right behaviour, and it is also the part people get wrong: they
// change it, close the tab, and are then locked out wondering why the old
// address still works. So the form says so plainly instead of showing "Saved".
export default function EmailForm({ current }: { current: string }) {
  const [email, setEmail] = useState(current);
  const [saving, setSaving] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const next = email.trim().toLowerCase();
  const changed = next && next !== current.toLowerCase();

  async function save() {
    setError(null);
    setSentTo(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(next)) {
      setError("That doesn't look like an email address.");
      return;
    }

    setSaving(true);
    const { error: updateError } = await createClient().auth.updateUser({ email: next });
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSentTo(next);
  }

  return (
    <div className="zv-card p-6 space-y-4">
      <div>
        <h2 className="font-semibold text-neutral-50">Email</h2>
        <p className="text-sm text-neutral-400 mt-1">
          You sign in with this, and payout notices go here.
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm text-neutral-300">Email address</span>
        <input
          className="zv-input"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
            setSentTo(null);
          }}
        />
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {sentTo && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 space-y-1">
          <p className="text-sm text-neutral-200">
            Confirmation sent to <strong className="text-neutral-50">{sentTo}</strong>.
          </p>
          <p className="text-xs text-neutral-400">
            Open the link in that inbox to finish the change. Until you do, keep signing in with{" "}
            <strong className="text-neutral-300">{current}</strong>.
          </p>
        </div>
      )}

      <button
        onClick={save}
        disabled={saving || !changed}
        className="zv-btn-secondary text-sm disabled:opacity-40"
      >
        {saving ? "Sending…" : "Change email"}
      </button>
    </div>
  );
}
