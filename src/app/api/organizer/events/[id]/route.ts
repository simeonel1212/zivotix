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

  // Only orders where money actually moved. A free ticket is marked "paid" the
  // moment it's claimed, but nothing was charged, nothing can be refunded and
  // no payout depends on it — so a free event, or a draft someone claimed a
  // free ticket for while it was being tested, has nothing worth protecting and
  // deletes like any other draft.
  const { count: settledOrders } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("event_id", id)
    .in("status", ["paid", "refunded"])
    .gt("base_amount", 0);

  if ((settledOrders ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          `${settledOrders} ${settledOrders === 1 ? "person has" : "people have"} paid real money for this ` +
          `event, so it can't be deleted — their tickets and your sales record depend on it. Unpublish it ` +
          `instead to take it off sale.`,
      },
      { status: 409 }
    );
  }

  // A payout referencing the event is the other thing that must not be
  // orphaned. Two ways that happens, and only checking the first is a trap:
  // a payout can name the event directly, or — far more commonly — it can be a
  // period payout with a null event_id whose payout_items point at this event's
  // orders. Miss the second and the delete gets past this guard only to fail on
  // a foreign key halfway through, having already removed the tickets.
  const { count: namedPayouts } = await supabase
    .from("payouts")
    .select("id", { count: "exact", head: true })
    .eq("event_id", id);

  const { data: orderIds } = await supabase.from("orders").select("id").eq("event_id", id);
  const ids = (orderIds ?? []).map((o) => o.id);
  const { count: payoutItems } = ids.length
    ? await supabase.from("payout_items").select("id", { count: "exact", head: true }).in("order_id", ids)
    : { count: 0 };

  if ((namedPayouts ?? 0) > 0 || (payoutItems ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          "This event's sales are part of a payout, so it can't be deleted — the payout would be left " +
          "claiming money with nothing behind it. Unpublish it instead.",
      },
      { status: 409 }
    );
  }

  // Children in dependency order. ticket_types, event_staff and
  // membership_check_ins cascade from the event itself; tickets and orders do
  // not, and both block the delete if left behind.
  //
  // Errors here are surfaced rather than swallowed: a failed child delete used
  // to leave the event half-dismantled and still standing, which is worse than
  // refusing outright.
  const { error: ticketsError } = await supabase.from("tickets").delete().eq("event_id", id);
  if (ticketsError) {
    return NextResponse.json({ error: ticketsError.message }, { status: 500 });
  }
  const { error: ordersError } = await supabase.from("orders").delete().eq("event_id", id);
  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 500 });
  }

  const { error: deleteError } = await supabase.from("events").delete().eq("id", id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true, title: event.title });
}
