"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import TicketBackdrop from "@/components/ticket-backdrop";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // Clicking the reset link lands here with a recovery token in the URL;
    // supabase-js exchanges it for a session automatically and fires this
    // event once that's done. If it never fires and there's no session
    // either, the link was invalid or already used.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setStatus("ready");
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setStatus("ready");
    });

    const timeout = setTimeout(() => {
      setStatus((s) => (s === "checking" ? "invalid" : s));
    }, 3000);

    return () => {
      listener.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setDone(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  return (
    <main className="flex-1 relative overflow-hidden flex items-center justify-center px-6 py-16">
      <div
        className="zv-glow-orb w-[400px] h-[400px] -bottom-32 -left-32"
        style={{ background: "linear-gradient(135deg, #fde047, #eab308)" }}
      />
      <TicketBackdrop className="opacity-70" />

      <div className="zv-card w-full max-w-sm p-8 relative z-10">
        {status === "checking" && (
          <p className="text-sm text-neutral-400 text-center py-8">Verifying your reset link…</p>
        )}

        {status === "invalid" && (
          <div className="space-y-4 text-center">
            <h1 className="text-2xl font-bold text-neutral-50">Link expired</h1>
            <p className="text-sm text-neutral-400">
              This reset link is invalid or has already been used. Request a new one below.
            </p>
            <a href="/forgot-password" className="inline-block text-sm font-semibold zv-gradient-text">
              Request a new link →
            </a>
          </div>
        )}

        {status === "ready" && !done && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-neutral-50">Set a new password</h1>
              <p className="text-sm text-neutral-400 mt-1">Choose something you haven&apos;t used before.</p>
            </div>

            <div className="space-y-1.5">
              <label className="zv-label">New password</label>
              <input
                type="password"
                required
                minLength={8}
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="zv-input"
              />
            </div>

            <div className="space-y-1.5">
              <label className="zv-label">Confirm password</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="zv-input"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button type="submit" disabled={loading} className="zv-btn-primary w-full">
              {loading ? "Saving…" : "Save new password"}
            </button>
          </form>
        )}

        {status === "ready" && done && (
          <div className="space-y-3 text-center">
            <h1 className="text-2xl font-bold text-neutral-50">Password updated</h1>
            <p className="text-sm text-neutral-400">Taking you to sign in…</p>
          </div>
        )}
      </div>
    </main>
  );
}
