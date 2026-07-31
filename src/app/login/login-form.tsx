"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(
        error.message.toLowerCase().includes("confirm")
          ? "Your email isn't verified yet. Sign up again with the same email to get a new code, or check your inbox for the original one."
          : error.message
      );
      return;
    }

    const next = params.get("next");
    if (next) {
      router.push(next);
      router.refresh();
      return;
    }

    // No specific page was requested — send them somewhere useful based on
    // their role instead of dropping them back on the public homepage.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    const destination =
      profile?.role === "admin"
        ? "/admin/payouts"
        : profile?.role === "door_staff"
        ? "/scan"
        : profile?.role === "organizer"
        ? "/organizer/dashboard"
        : "/";

    router.push(destination);
    router.refresh();
  }

  return (
    <div className="zv-card w-full max-w-sm p-8">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-neutral-50">Welcome back</h1>
          <p className="text-sm text-neutral-400 mt-1">Log in to manage your events or scan tickets.</p>
        </div>

        <div className="space-y-1.5">
          <label className="zv-label">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="zv-input"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="zv-label">Password</label>
            <a href="/forgot-password" className="text-xs font-semibold zv-gradient-text">
              Forgot password?
            </a>
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="zv-input"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button type="submit" disabled={loading} className="zv-btn-primary w-full">
          {loading ? "Signing in…" : "Log in"}
        </button>

        <p className="text-sm text-neutral-400 text-center">
          Organizing events?{" "}
          <a href="/signup" className="font-semibold zv-gradient-text">
            Create an organizer account
          </a>
        </p>
      </form>
    </div>
  );
}
