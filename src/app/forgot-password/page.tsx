"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import TicketBackdrop from "@/components/ticket-backdrop";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    // Deliberately generic either way — don't reveal whether the email
    // has an account (same reasoning Supabase applies to signup).
    if (resetError && !resetError.message?.includes("rate limit")) {
      setSent(true);
      return;
    }
    if (resetError) {
      setError("Too many attempts. Wait a minute and try again.");
      return;
    }
    setSent(true);
  }

  return (
    <main className="flex-1 relative overflow-hidden flex items-center justify-center px-6 py-16">
      <div
        className="zv-glow-orb w-[400px] h-[400px] -top-32 -right-32"
        style={{ background: "linear-gradient(135deg, #facc15, #ca8a04)" }}
      />
      <TicketBackdrop className="opacity-70" />

      <div className="zv-card w-full max-w-sm p-8 relative z-10">
        {sent ? (
          <div className="space-y-5 text-center">
            <h1 className="text-2xl font-bold text-neutral-900">Check your email</h1>
            <p className="text-sm text-neutral-500">
              If an account exists for <span className="font-medium text-neutral-800">{email}</span>, we&apos;ve
              sent a link to reset your password. It may take a minute to arrive, so check spam too.
            </p>
            <a href="/login" className="inline-block text-sm font-semibold zv-gradient-text">
              ← Back to sign in
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">Reset your password</h1>
              <p className="text-sm text-neutral-500 mt-1">
                Enter the email on your account and we&apos;ll send you a reset link.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="zv-label">Email</label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="zv-input"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button type="submit" disabled={loading} className="zv-btn-primary w-full">
              {loading ? "Sending…" : "Send reset link"}
            </button>

            <p className="text-center text-sm text-neutral-500">
              Remembered it after all?{" "}
              <a href="/login" className="font-semibold zv-gradient-text">
                Sign in
              </a>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
