import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Organizer } from "@/lib/types";

// Single place that answers "which organizer is the signed-in user?".
//
// Every organizer dashboard page needs this, and each one used to inline it
// with `.single()` plus `user!.id`. Both are traps:
//
//   * `.single()` throws when it matches zero rows, so `data` comes back null
//     and the page silently continues with no organizer.
//   * The pages then fell back to `organizer?.id ?? ""` or passed undefined
//     straight into a filter on a uuid column, which Postgres rejects with
//     "invalid input syntax for type uuid" — surfacing to the user as a raw
//     database error rather than anything meaningful.
//
// That happens for real accounts: an admin has no organizer row of their own,
// and a signup that half-completed leaves a profile without one. `maybeSingle`
// returns null cleanly instead of erroring, and callers get an explicit
// `organizer: null` to handle rather than an empty string to accidentally
// query with.
export async function getCurrentOrganizer(nextPath: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware normally catches this, but a session can expire between the
  // middleware check and the page render.
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);

  const { data: organizer } = await supabase
    .from("organizers")
    .select("*")
    .eq("profile_id", user.id)
    .maybeSingle<Organizer>();

  return { supabase, user, organizer };
}
