import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assessMembership, membershipRefusalMessage } from "@/lib/memberships";
import type { Membership } from "@/lib/types";

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

  // Not a ticket — it may be a membership pass, which follows entirely
  // different rules: valid for many events, once each, until its credits run
  // out. The ticket path below is untouched by this.
  if (!ticket) {
    // A merch pickup code is checked before the membership path because it's
    // the cheaper lookup and the two token spaces never overlap.
    const merch = await scanMerchPickup(supabase, token, user.id);
    if (merch) return merch;
    return scanMembership(supabase, token, eventId, user.id);
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

// ---------------------------------------------------------------- memberships
//
// A pass differs from a ticket in three ways that all matter at a door:
//   · it admits its holder to many events, once each
//   · it carries a finite number of credits
//   · the organizer can exclude a specific event from membership entry
//
// "Used" therefore can't live on the pass. It lives on the (pass, event) pair
// in membership_check_ins, which has a unique constraint — so two door staff
// scanning the same pass at the same instant can't both succeed.
async function scanMembership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  token: string,
  eventId: string | undefined,
  userId: string
) {
  const { data: membership } = await supabase
    .from("memberships")
    .select("id, organizer_id, member_name, status, credits_total, credits_used, starts_at, expires_at")
    .eq("qr_token", token)
    .maybeSingle<Membership>();

  if (!membership) return NextResponse.json({ result: "invalid" });

  // Without an event we can't decide anything: a pass is only meaningful
  // against a specific door.
  if (!eventId) {
    return NextResponse.json({ result: "invalid", reason: "No event selected" }, { status: 400 });
  }

  const { data: event } = await supabase
    .from("events")
    .select("id, title, organizer_id, members_included")
    .eq("id", eventId)
    .maybeSingle<{ id: string; title: string; organizer_id: string; members_included: boolean }>();

  if (!event) return NextResponse.json({ result: "invalid" });

  // A pass from a different organizer is a real pass at the wrong door.
  if (event.organizer_id !== membership.organizer_id) {
    return NextResponse.json({ result: "wrong_event", isMembership: true });
  }

  // The organizer excluded this night — headliner, New Year's, whatever.
  if (!event.members_included) {
    return NextResponse.json({
      result: "members_excluded",
      isMembership: true,
      memberName: membership.member_name,
    });
  }

  // Already in tonight? Say so rather than spending another credit.
  const { data: existing } = await supabase
    .from("membership_check_ins")
    .select("id, checked_in_at")
    .eq("membership_id", membership.id)
    .eq("event_id", event.id)
    .maybeSingle<{ id: string; checked_in_at: string }>();

  if (existing) {
    return NextResponse.json({
      result: "already_used",
      isMembership: true,
      memberName: membership.member_name,
      checkedInAt: existing.checked_in_at,
    });
  }

  const state = assessMembership(membership);
  if (!state.usable) {
    return NextResponse.json({
      result: "pass_not_valid",
      isMembership: true,
      memberName: membership.member_name,
      message: membershipRefusalMessage(state.reason),
    });
  }

  // The insert is the gate. If a second scanner got here first the unique
  // constraint rejects this one, and we report it as already used rather than
  // admitting the same person twice.
  const { error: insertError } = await supabase.from("membership_check_ins").insert({
    membership_id: membership.id,
    event_id: event.id,
    checked_in_by: userId,
  });

  if (insertError) {
    const raced = insertError.code === "23505"; // unique_violation
    return NextResponse.json({
      result: raced ? "already_used" : "invalid",
      isMembership: true,
      memberName: membership.member_name,
    });
  }

  // Counter kept on the row so the pass page and the door can show credits
  // without counting rows. The check-ins table remains the source of truth.
  //
  // Still incremented on a period pass, even though nothing counts down from
  // it: it's the organizer's attendance figure, and the unique constraint on
  // (membership_id, event_id) is what actually stops a second entry to the
  // same event. Unlimited means unlimited events, not unlimited entries to one.
  await supabase
    .from("memberships")
    .update({ credits_used: membership.credits_used + 1 })
    .eq("id", membership.id);

  return NextResponse.json({
    result: "valid",
    isMembership: true,
    memberName: membership.member_name,
    // Null on a period pass: the door needs "valid until March", not a
    // counter that would read 0 and look like a refusal.
    creditsLeft: state.creditsLeft === null ? null : state.creditsLeft - 1,
    creditsTotal: membership.credits_total,
    expiresAt: membership.expires_at,
  });
}

// ---------------------------------------------------------------------- merch
//
// A merch pickup code is the simplest of the three: it isn't tied to an event
// and it can only be redeemed once, because it represents one physical object
// leaving the organizer's hands.
//
// Returns null rather than a response when the token isn't a pickup code, so
// the caller can fall through to the membership check.
async function scanMerchPickup(
  supabase: Awaited<ReturnType<typeof createClient>>,
  token: string,
  userId: string
) {
  const { data: order } = await supabase
    .from("merch_orders")
    .select("id, organizer_id, buyer_name, quantity, size, status, fulfilled_at, product_id")
    .eq("pickup_token", token)
    .maybeSingle<{
      id: string;
      organizer_id: string;
      buyer_name: string;
      quantity: number;
      size: string | null;
      status: string;
      fulfilled_at: string | null;
      product_id: string;
    }>();

  if (!order) return null;

  if (order.status !== "paid") {
    return NextResponse.json({ result: "invalid", reason: "Not paid" });
  }
  if (order.fulfilled_at) {
    return NextResponse.json({ result: "already_used", isMerch: true, buyerName: order.buyer_name });
  }

  const { data: product } = await supabase
    .from("merch_products")
    .select("name")
    .eq("id", order.product_id)
    .maybeSingle<{ name: string }>();

  // Conditional on fulfilled_at still being null, so two staff scanning the
  // same code at once can't both hand out a shirt.
  const { data: claimed } = await supabase
    .from("merch_orders")
    .update({ fulfilled_at: new Date().toISOString() })
    .eq("id", order.id)
    .is("fulfilled_at", null)
    .select("id");

  if (!claimed?.length) {
    return NextResponse.json({ result: "already_used", isMerch: true, buyerName: order.buyer_name });
  }

  void userId;
  return NextResponse.json({
    result: "valid",
    isMerch: true,
    buyerName: order.buyer_name,
    item: product?.name ?? "Item",
    quantity: order.quantity,
    size: order.size,
  });
}
