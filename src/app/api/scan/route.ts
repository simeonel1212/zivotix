import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Called by the door-staff scanner after decoding a QR code.
// Returns one of: valid (and marks it used), already_used, wrong_event, or
// invalid.
//
// Runs with the caller's session (not the service role) so RLS's
// `tickets_staff_checkin` policy enforces that staff can only check in
// tickets for events they're assigned to.
export async function POST(req: Request) {
  const { token, eventId } = (await req.json()) as { token: string; eventId?: string };
  if (!token) return NextResponse.json({ result: "invalid" }, { status: 400 });

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ result: "invalid", reason: "Not signed in" }, { status: 401 });

  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, status, event_id, checked_in_at, ticket_types(name), events(title)")
    .eq("qr_token", token)
    .maybeSingle();

  if (!ticket) {
    return NextResponse.json({ result: "invalid" });
  }

  // The scanner is scoped to one event at a time. A ticket for a different
  // event is real and valid — it just isn't for this door — so it gets its
  // own result rather than being lumped in with "invalid". Marking it used
  // here would silently burn a ticket the holder still needs elsewhere.
  if (eventId && ticket.event_id !== eventId) {
    return NextResponse.json({
      result: "wrong_event",
      eventTitle: (ticket as { events?: { title?: string } }).events?.title,
    });
  }

  if (ticket.status === "used") {
    return NextResponse.json({
      result: "already_used",
      checkedInAt: ticket.checked_in_at,
    });
  }

  if (ticket.status === "void") {
    return NextResponse.json({ result: "invalid" });
  }

  const { data: updated, error } = await supabase
    .from("tickets")
    .update({ status: "used", checked_in_at: new Date().toISOString(), checked_in_by: user.id })
    .eq("id", ticket.id)
    .eq("status", "valid") // guards against a race between two simultaneous scans
    .select("id");

  if (error) {
    return NextResponse.json({ result: "invalid", reason: "Not authorized for this event" }, { status: 403 });
  }

  // Zero rows updated means another scanner won the race in the moment
  // between our read and our write. Reporting "valid" here would let the same
  // ticket admit two people.
  if (!updated?.length) {
    return NextResponse.json({ result: "already_used" });
  }

  return NextResponse.json({
    result: "valid",
    ticketType: (ticket as { ticket_types?: { name?: string } }).ticket_types?.name,
  });
}
