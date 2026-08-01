"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Setting a new password.
//
// No "current password" field, and that is deliberate rather than an omission:
// Supabase authenticates this call with the session token, so the person typing
// is already proven to be signed in. Asking for the old one would be theatre —
// it protects nothing an attacker with the session doesn't already have.
//
// The confirmation field is not theatre. A mistyped password that nobody
// notices locks the account until a reset email, and a reset email is exactly
// the flow this page exists to avoid.
const MIN_LENGTH = 8;

export default function PasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && password !== confirm;
  const ready = password.length >= MIN_LENGTH && password === confirm;

  async function save() {
    setError(null);
    if (!ready) return;

    setSaving(true);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    // Cleared immediately: there is no reason for a password to sit in a form
    // field on a shared laptop after it has been saved.
    setPassword("");
    setConfirm("");
    setSaved(true);
    setTimeout(() => setSaved(false), 4000);
  }

  return (
    <div className="zv-card p-6 space-y-4">
      <div>
        <h2 className="font-semibold text-neutral-50">Password</h2>
        <p className="text-sm text-neutral-400 mt-1">
          At least {MIN_LENGTH} characters. You&apos;ll stay signed in on this device.
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm text-neutral-300">New password</span>
        <input
          className="zv-input"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
        />
        {tooShort && (
          <span className="block text-xs text-amber-400">
            A bit longer — {MIN_LENGTH} characters minimum.
          </span>
        )}
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm text-neutral-300">Confirm new password</span>
        <input
          className="zv-input"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            setError(null);
          }}
        />
        {mismatch && (
          <span className="block text-xs text-amber-400">These two don&apos;t match.</span>
        )}
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {saved && <p className="text-sm text-emerald-400">Password changed.</p>}

      <button
        onClick={save}
        disabled={saving || !ready}
        className="zv-btn-secondary text-sm disabled:opacity-40"
      >
        {saving ? "Saving…" : "Change password"}
      </button>
    </div>
  );
}
