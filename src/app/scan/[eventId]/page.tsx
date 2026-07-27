import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EventScanner from "./event-scanner";

// Camera scoped to a single event.
//
// The counts are read here, server-side, so the header shows real numbers on
// first paint rather than flashing "0 of 0" while a client fetch resolves.
// Both queries run on the caller's session, so RLS decides what they can see:
// if a staff member isn't assigned to this event, the ticket query returns
// nothing and they get a 404 rather than a usable scanner.
export default async function EventScanPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/scan/${eventId}`)}`);
  }

  const { data: event } = await supabase
    .from("events")
    .select("id, title")
    .eq("id", eventId)
    .maybeSingle<{ id: string; title: string }>();

  if (!event) notFound();

  const { data: tickets } = await supabase
    .from("tickets")
    .select("status")
    .eq("event_id", eventId)
    .returns<{ status: string }[]>();

  // Events are publicly readable, so reaching this page proves nothing about
  // permission. An empty ticket read is what actually tells us this person
  // has no business scanning here.
  if (!tickets?.length) notFound();

  const live = tickets.filter((t) => t.status !== "void");
  const sold = live.length;
  const scanned = live.filter((t) => t.status === "used").length;

  return (
    <EventScanner
      eventId={event.id}
      eventTitle={event.title}
      initialSold={sold}
      initialScanned={scanned}
    />
  );
}
