"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Lands here right after a Supabase magic-link click. The session tokens
// arrive as a URL hash fragment (#access_token=...) — the server (and so
// middleware's route protection) never sees a hash fragment, only the
// browser does. This page is deliberately NOT behind middleware: it just
// needs to run client-side long enough for the Supabase browser client to
// pick up the hash, establish a session (writing the cookie middleware
// checks), then hand off to the real destination.
export default function AuthCallbackClient() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let done = false;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !done) {
        done = true;
        router.replace(next);
      }
    });

    // Covers the case where the session was already picked up before this
    // effect's listener attached.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !done) {
        done = true;
        router.replace(next);
      }
    });

    const timeout = setTimeout(() => {
      if (!done) setFailed(true);
    }, 6000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [next, router]);

  return (
    <main className="flex-1 flex items-center justify-center px-6">
      <div className="zv-card max-w-sm w-full text-center space-y-3 p-10">
        {failed ? (
          <>
            <h1 className="text-xl font-bold text-neutral-900">That link didn&apos;t work</h1>
            <p className="text-sm text-neutral-500">
              It may have expired or already been used. Ask whoever invited you to send a fresh link.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto h-8 w-8 rounded-full border-2 border-yellow-500 border-t-transparent animate-spin" />
            <p className="text-sm text-neutral-500">Signing you in…</p>
          </>
        )}
      </div>
    </main>
  );
}
