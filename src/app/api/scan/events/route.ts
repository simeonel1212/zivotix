import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Events the signed-in person is allowed to scan, each with its ticket
// counts. Backs the scanner's home screen.
//
// Deliberately runs on the caller's session rather than the service role: the
// same RLS policies that stop door staff checking in a ticket for someone
// else's event also decide what they can see here. Using the service role
// would mean reimplementing that permission logic by hand in this file, and
// the two copies would eventually disagree.
export interface ScannerEvent {
  id: string;
  title: string;
  venue: string | null;
  city: string | null;
  startsAt: string;
  sold: number;
  scanned: number;
}

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Every ticket this person can read. RLS narrows it to their own events
  // (organizer), the events they're on the door for (staff), or everything
  // (admin). event_id is what we group by.
  const { data: tickets, error } = await supabase
    .from("tickets")
    .select("event_id, status")
    .returns<{ event_id: string; status: string }[]>();

  if (error) {
    return NextResponse.json({ error: "Could not load tickets" }, { status: 500 });
  }

  if (!tickets?.length) {
    return NextResponse.json({ events: [] });
  }

  const counts = new Map<string, { sold: number; scanned: number }>();
  for (const t of tickets) {
    const row = counts.get(t.event_id) ?? { sold: 0, scanned: 0 };
    // Void tickets (refunded, cancelled) aren't a real attendee and shouldn't
    // inflate the number the door is counting down from.
    if (t.status === "void") continue;
    row.sold += 1;
    if (t.status === "used") row.scanned += 1;
    counts.set(t.event_id, row);
  }

  const { data: events } = await supabase
    .from("events")
    .select("id, title, venue, city, starts_at")
    .in("id", [...counts.keys()])
    .returns<{ id: string; title: string; venue: string | null; city: string | null; starts_at: string }[]>();

  const result: ScannerEvent[] = (events ?? [])
    .map((e) => ({
      id: e.id,
      title: e.title,
      venue: e.venue,
      city: e.city,
      startsAt: e.starts_at,
      sold: counts.get(e.id)?.sold ?? 0,
      scanned: counts.get(e.id)?.scanned ?? 0,
    }))
    // Soonest first. Someone opening this at a venue is almost always working
    // whichever event is closest to now, so it should be the top row.
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  return NextResponse.json({ events: result });
}
