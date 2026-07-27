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
    if (!eventIds.length) continue;

    const { data: orders } = await service
      .from("orders")
      .select("*")
      .in("event_id", eventIds)
      .eq("status", "paid");

    const unpaid = (orders ?? []).filter((o) => !excluded.has(o.id));
    if (!unpaid.length) continue;

    // Organizers keep 100% of face value — Zivotix is paid by the buyer's
    // service fee, which lives on the order and never enters gross_sales.
    // See supabase/migrations/2026-07-27-buyer-paid-service-fee.sql.
    const grossSales = unpaid.reduce((s, o) => s + o.base_amount, 0);
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

    await service
      .from("payout_items")
      .insert(unpaid.map((o) => ({ payout_id: payout.id, order_id: o.id, amount: o.base_amount })));

    created.push(payout);
  }

  return NextResponse.json({ created: created.length, payouts: created });
}
