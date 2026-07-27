"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Account control for the installed scanner.
//
// An installed app has no address bar, so there's no way to reach a sign-out
// page by hand and no visible clue as to which account is signed in. On a
// shared door phone that matters: whoever scanned last stays signed in
// forever otherwise, and their name ends up against every check-in.
export default function ScannerAccount({
  name,
  email,
  role,
  tone = "dark",
}: {
  name: string;
  email: string;
  role: string;
  tone?: "dark" | "light";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    setSigningOut(true);
    await createClient().auth.signOut();
    // Back to /scan after signing in again, so the next person lands in the
    // app rather than on the marketing site.
    router.push(`/login?next=${encodeURIComponent("/scan")}`);
    router.refresh();
  }

  const initial = (name || email || "?").trim().charAt(0).toUpperCase();
  const dark = tone === "dark";

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account"
        aria-expanded={open}
        className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-bold transition active:scale-95 ${
          dark
            ? "border-white/15 bg-white/5 text-white"
            : "border-neutral-200 bg-neutral-100 text-neutral-700"
        }`}
      >
        {initial}
      </button>

      {open && (
        <div
          className={`absolute right-0 top-12 z-30 w-64 overflow-hidden rounded-2xl border shadow-2xl ${
            dark ? "border-white/10 bg-neutral-900" : "border-neutral-200 bg-white"
          }`}
        >
          <div className={`px-4 py-3.5 border-b ${dark ? "border-white/10" : "border-neutral-100"}`}>
            <p className={`text-sm font-semibold truncate ${dark ? "text-white" : "text-neutral-900"}`}>
              {name}
            </p>
            <p className={`text-xs truncate ${dark ? "text-neutral-400" : "text-neutral-500"}`}>{email}</p>
            <span
              className={`zv-badge mt-2 ${
                dark ? "bg-yellow-400/15 text-yellow-300" : "bg-yellow-400/20 text-yellow-700"
              }`}
            >
              {role}
            </span>
          </div>

          <button
            onClick={signOut}
            disabled={signingOut}
            className={`w-full px-4 py-3.5 text-left text-sm font-medium transition disabled:opacity-50 ${
              dark ? "text-rose-300 hover:bg-white/5" : "text-rose-600 hover:bg-neutral-50"
            }`}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
