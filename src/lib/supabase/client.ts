"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client. Uses the anon key — safe to expose,
// row-level security policies (see supabase/schema.sql) do the real access control.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
