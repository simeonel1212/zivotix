import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Deletes an event outright.
//
// Unpublishing hides an event; this removes it. Both need to exist, because a
// draft made by mistake or a duplicate created twice has no business sitting in
// the list forever, and "unpublish" doesn't get rid of it.
//
// What it refuses to touch is anything with money attached. A paid or refunded
// order is a financial record — someone was charged, someone holds a ticket, and
// the payout run reads it. Deleting the event would orphan all of that with no
// way back. Those events can be cancelled or unpublished instead, which is the
// honest operation: the event stopped, the record of who paid did not.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // RLS restricts events to their owner, so a row coming back here is proof of
  // ownership; no separate organizer check needed.
  const { data: event } = await supabase
    .from("events")
    .select("id, title")
    .eq("id", id)
    .maybeSingle();
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const { count: settledOrders } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("event_id", id)
    .in("status", ["paid", "refunded"]);

  if ((settledOrders ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          `${settledOrders} ${settledOrders === 1 ? "person has" : "people have"} paid for this event, ` +
          `so it can't be deleted — their tickets and your sales record depend on it. Unpublish it instead ` +
          `to take it off sale.`,
      },
      { status: 409 }
    );
  }

  // A payout referencing the event is the other thing that must not be orphaned.
  const { count: payouts } = await supabase
    .from("payouts")
    .select("id", { count: "exact", head: true })
    .eq("event_id", id);

  if ((payouts ?? 0) > 0) {
    return NextResponse.json(
      { error: "This event is part of a payout, so it can't be deleted. Unpublish it instead." },
      { status: 409 }
    );
  }

  // Children in dependency order. ticket_types, event_staff and
  // membership_check_ins cascade from the event itself; tickets and orders do
  // not, and both block the delete if left behind.
  await supabase.from("tickets").delete().eq("event_id", id);
  await supabase.from("orders").delete().eq("event_id", id);

  const { error: deleteError } = await supabase.from("events").delete().eq("id", id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true, title: event.title });
}
