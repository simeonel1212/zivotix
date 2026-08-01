import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// Computes each organizer's unpaid gross sales (paid orders not yet attached
// to a payout) and materializes a `payouts` row + `payout_items` per
// organizer with a non-zero balance. Run this every Wednesday.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const service = createServiceClient();

  const { data: organizers } = await service.from("organizers").select("*");
  const { data: alreadyPaidOutOrderIds } = await service.from("payout_items").select("order_id");
  const excluded = new Set((alreadyPaidOutOrderIds ?? []).map((r) => r.order_id));

  const created = [];
  const periodStart = new Date(0).toISOString(); // simplification: "everything not yet paid out"
  const periodEnd = new Date().toISOString();

  for (const organizer of organizers ?? []) {
    const { data: events } = await service.from("events").select("id").eq("organizer_id", organizer.id);
    const eventIds = (events ?? []).map((e) => e.id);

    const { data: orders } = eventIds.length
      ? await service.from("orders").select("*").in("event_id", eventIds).eq("status", "paid")
      : { data: [] };

    const unpaid = (orders ?? []).filter((o) => !excluded.has(o.id));

    // Membership revenue belongs to the organizer, not to any event, so it's
    // collected separately and joined here. An organizer can sell passes
    // without having run an event yet — which is the whole point of selling
    // them in advance — so this runs even when eventIds is empty.
    //
    // Refunded and cancelled passes are excluded: that money went back to the
    // member and was never the organizer's.
    const { data: memberships } = await service
      .from("memberships")
      .select("id, base_amount")
      .eq("organizer_id", organizer.id)
      .not("paid_at", "is", null)
      .is("payout_id", null)
      .in("status", ["active", "expired"])
      .returns<{ id: string; base_amount: number }[]>();

    // Merch, on the same terms. Refunded orders are excluded for the same
    // reason: that money went back to the buyer.
    //
    // Unfulfilled orders are deliberately still paid out. The organizer has
    // the money and owes the buyer an object; withholding their revenue until
    // a parcel is posted would make Zivotix an escrow service, which is a
    // different business with different licences.
    const { data: merchOrders } = await service
      .from("merch_orders")
      .select("id, base_amount")
      .eq("organizer_id", organizer.id)
      .eq("status", "paid")
      .not("paid_at", "is", null)
      .is("payout_id", null)
      .returns<{ id: string; base_amount: number }[]>();

    const unpaidMerch = merchOrders ?? [];
    const unpaidMemberships = memberships ?? [];
    if (!unpaid.length && !unpaidMemberships.length && !unpaidMerch.length) continue;

    // Organizers keep 100% of face value — Zivotix is paid by the buyer's
    // service fee, which lives on the order or membership and never enters
    // gross_sales. See supabase/migrations/2026-07-27-buyer-paid-service-fee.sql.
    const ticketGross = unpaid.reduce((s, o) => s + o.base_amount, 0);
    const membershipGross = unpaidMemberships.reduce((s, m) => s + m.base_amount, 0);
    const merchGross = unpaidMerch.reduce((s, m) => s + m.base_amount, 0);
    const grossSales = ticketGross + membershipGross + merchGross;
    const platformFee = 0;
    const netPayable = Math.round(grossSales * 100) / 100;
    if (netPayable <= 0) continue;

    const { data: payout, error } = await service
      .from("payouts")
      .insert({
        organizer_id: organizer.id,
        period_start: periodStart,
        period_end: periodEnd,
        gross_sales: grossSales,
        platform_fee: platformFee,
        net_payable: netPayable,
        currency: organizer.payout_currency,
        status: "pending",
      })
      .select()
      .single();
    if (error || !payout) continue;

    if (unpaid.length) {
      await service
        .from("payout_items")
        .insert(unpaid.map((o) => ({ payout_id: payout.id, order_id: o.id, amount: o.base_amount })));
    }

    // Stamping the memberships is what stops them being paid out twice — the
    // equivalent of a payout_item, kept on the row because payout_items is
    // keyed to orders.
    if (unpaidMemberships.length) {
      await service
        .from("memberships")
        .update({ payout_id: payout.id })
        .in(
          "id",
          unpaidMemberships.map((m) => m.id)
        );
    }

    // Same stamping trick as memberships: payout_items is keyed to orders, so
    // merch records its payout on its own row.
    if (unpaidMerch.length) {
      await service
        .from("merch_orders")
        .update({ payout_id: payout.id })
        .in(
          "id",
          unpaidMerch.map((m) => m.id)
        );
    }

    created.push(payout);
  }

  return NextResponse.json({ created: created.length, payouts: created });
}
