import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EventList from "./event-list";

// Scanner home: the events this person can scan, each with its ticket counts.
// Choosing an event opens the camera scoped to it.
//
// Auth is checked here rather than in the client component so an unauthorised
// device never renders the app shell at all — it goes straight to login and
// comes back here afterwards.
export default async function ScanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/scan")}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  // Organizers get a Community tab; door staff don't, since they have no
  // posts of their own to write.
  const { data: organizer } = await supabase
    .from("organizers")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  return (
    <EventList
      staffName={profile?.full_name || user.email || "staff"}
      isOrganizer={Boolean(organizer)}
    />
  );
}
