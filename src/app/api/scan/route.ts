import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Called by the door-staff scan page after decoding a QR code.
// Returns one of: valid (and marks it used), already_used, or invalid.
// Runs with the caller's session (not the service role) so RLS's
// `tickets_staff_checkin` policy enforces that staff can only check in
// tickets for events they're assigned to.
export async function POST(req: Request) {
  const { token } = (await req.json()) as { token: string };
  if (!token) return NextResponse.json({ result: "invalid" }, { status: 400 });

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ result: "invalid", reason: "Not signed in" }, { status: 401 });

  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, status, event_id, checked_in_at, ticket_types(name)")
    .eq("qr_token", token)
    .single();

  if (!ticket) {
    return NextResponse.json({ result: "invalid" });
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

  const { error } = await supabase
    .from("tickets")
    .update({ status: "used", checked_in_at: new Date().toISOString(), checked_in_by: user.id })
    .eq("id", ticket.id)
    .eq("status", "valid"); // guards against a race between two simultaneous scans

  if (error) {
    return NextResponse.json({ result: "invalid", reason: "Not authorized for this event" }, { status: 403 });
  }

  return NextResponse.json({ result: "valid", ticketType: (ticket as { ticket_types?: { name?: string } }).ticket_types?.name });
}
