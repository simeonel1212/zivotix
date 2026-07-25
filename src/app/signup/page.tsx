"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import TicketBackdrop from "@/components/ticket-backdrop";

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "verify">("form");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    businessName: "",
    country: "NG",
  });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Check first: if this email already has a confirmed account, Supabase
    // will silently pretend to succeed without sending anything (a security
    // measure). Catch that here instead of leaving the user staring at a
    // code screen that will never receive anything.
    try {
      const statusRes = await fetch("/api/auth/email-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email }),
      });
      const status = await statusRes.json();
      if (status.exists && status.confirmed) {
        setLoading(false);
        setError("This email already has an account. Try signing in instead.");
        return;
      }
    } catch {
      // If the check itself fails, fall through and attempt signup as normal.
    }

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.fullName, role: "organizer" } },
    });

    setLoading(false);

    if (signUpError || !data.user) {
      // Supabase's auth SDK treats any 5xx response as a generic "retryable
      // network error" and never reads the real error body in that case —
      // its message ends up being the literal string "{}" (JSON.stringify
      // of the raw, propertyless Response object). A 500 here is almost
      // always the confirmation email failing to send, so say that plainly
      // instead of surfacing the SDK's unhelpful placeholder.
      const rawMessage = signUpError?.message;
      const isUselessMessage = !rawMessage || rawMessage === "{}";
      setError(
        isUselessMessage
          ? "We couldn't send a verification email to that address right now. Double-check the address is correct, or try again in a minute."
          : rawMessage
      );
      return;
    }

    // If a session came back immediately, email confirmation isn't required
    // on this project — skip straight to creating the organizer profile.
    if (data.session) {
      await finishSignup(supabase);
      return;
    }

    setStep("verify");
  }

  async function finishSignup(supabase: ReturnType<typeof createClient>) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Something went wrong confirming your account. Try signing in.");
      return;
    }

    const { error: orgError } = await supabase.from("organizers").insert({
      profile_id: user.id,
      business_name: form.businessName,
      country: form.country,
      payout_currency: form.country === "NG" ? "NGN" : "THB",
    });

    if (orgError) {
      setError(orgError.message);
      return;
    }

    router.push("/organizer/dashboard");
    router.refresh();
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: form.email,
      token: code,
      type: "signup",
    });

    if (verifyError) {
      setLoading(false);
      setError(verifyError.message);
      return;
    }

    await finishSignup(supabase);
    setLoading(false);
  }

  async function handleResend() {
    setError(null);
    setResendMsg(null);
    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: form.email,
    });
    setResendMsg(resendError ? null : "Sent. Check your inbox (and spam folder).");
    if (resendError) setError(resendError.message);
  }

  return (
    <main className="flex-1 relative overflow-hidden flex items-center justify-center px-6 py-16">
      <div
        className="zv-glow-orb w-[420px] h-[420px] -bottom-40 -left-32"
        style={{ background: "linear-gradient(135deg, #fde047, #eab308)" }}
      />
      <TicketBackdrop className="opacity-70" />

      {step === "form" ? (
        <div className="zv-card w-full max-w-sm p-8 relative z-10">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">Start selling tickets</h1>
              <p className="text-sm text-neutral-500 mt-1">Set up your organizer account in a minute.</p>
            </div>

            <div className="space-y-1.5">
              <label className="zv-label">Full name</label>
              <input required value={form.fullName} onChange={(e) => update("fullName", e.target.value)} className="zv-input" />
            </div>

            <div className="space-y-1.5">
              <label className="zv-label">Business / event brand name</label>
              <input
                required
                value={form.businessName}
                onChange={(e) => update("businessName", e.target.value)}
                className="zv-input"
              />
            </div>

            <div className="space-y-1.5">
              <label className="zv-label">Country</label>
              <select value={form.country} onChange={(e) => update("country", e.target.value)} className="zv-input">
                <option value="NG">Nigeria (payouts in NGN)</option>
                <option value="TH">Thailand (payouts in THB)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="zv-label">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                className="zv-input"
              />
            </div>

            <div className="space-y-1.5">
              <label className="zv-label">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                className="zv-input"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button type="submit" disabled={loading} className="zv-btn-primary w-full">
              {loading ? "Creating account…" : "Create account"}
            </button>

            <p className="text-center text-sm text-neutral-500">
              Already have an account?{" "}
              <a href="/login" className="font-semibold zv-gradient-text">
                Sign in
              </a>
            </p>

            <p className="text-center text-xs text-neutral-400">
              By creating an account, you agree to our{" "}
              <a href="/terms" className="underline hover:text-neutral-600">
                Terms
              </a>{" "}
              and{" "}
              <a href="/privacy" className="underline hover:text-neutral-600">
                Privacy Policy
              </a>
              .
            </p>
          </form>
        </div>
      ) : (
        <div className="zv-card w-full max-w-sm p-8 relative z-10">
          <form onSubmit={handleVerify} className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">Check your email</h1>
              <p className="text-sm text-neutral-500 mt-1">
                We sent a verification code to <span className="font-medium text-neutral-800">{form.email}</span>.
                Enter it below to activate your account.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="zv-label">Verification code</label>
              <input
                required
                inputMode="numeric"
                autoFocus
                maxLength={8}
                placeholder="12345678"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="zv-input text-center text-lg tracking-[0.3em] font-semibold"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {resendMsg && <p className="text-sm text-emerald-600">{resendMsg}</p>}

            <button type="submit" disabled={loading || code.length < 6} className="zv-btn-primary w-full disabled:opacity-40">
              {loading ? "Verifying…" : "Verify & continue"}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button type="button" onClick={() => setStep("form")} className="text-neutral-500 hover:text-neutral-800">
                ← Back
              </button>
              <button type="button" onClick={handleResend} className="font-semibold zv-gradient-text">
                Resend code
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
