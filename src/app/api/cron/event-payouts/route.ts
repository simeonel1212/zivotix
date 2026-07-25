import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { estimateProcessorFee } from "@/lib/processor-fees";

// Runs daily (see vercel.json). For every event whose end time (or start
// time, if it has no end time) passed 24+ hours ago, and that doesn't
// already have a payout, this creates one automatically with the correct
// net-payable amount — but does NOT send any money. The actual transfer
// still needs a click from /admin/payouts (PayViaPaystackButton or
// MarkPaidForm), by design: this only automates the calculation and timing,
// not the movement of real money. See supabase/schema.sql for why.
//
// Idempotent by construction (required for Vercel cron, which can invoke a
// run more than once): an event is only picked up if none of its paid
// orders are already attached to a payout via payout_items, so a duplicate
// invocation naturally finds nothing left to do.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: candidateEvents } = await service
    .from("events")
    .select("id, organizer_id, starts_at, ends_at")
    .or(`ends_at.lte.${cutoff},and(ends_at.is.null,starts_at.lte.${cutoff})`);

  const { data: alreadyPaidOutOrderIds } = await service.from("payout_items").select("order_id");
  const excludedOrders = new Set((alreadyPaidOutOrderIds ?? []).map((r) => r.order_id));

  const { data: existingEventPayouts } = await service.from("payouts").select("event_id").not("event_id", "is", null);
  const excludedEvents = new Set((existingEventPayouts ?? []).map((p) => p.event_id));

  const created = [];

  for (const event of candidateEvents ?? []) {
    if (excludedEvents.has(event.id)) continue;

    const { data: organizer } = await service.from("organizers").select("*").eq("id", event.organizer_id).single();
    if (!organizer) continue;

    const { data: orders } = await service
      .from("orders")
      .select("id, base_amount, base_currency, payment_provider")
      .eq("event_id", event.id)
      .eq("status", "paid");

    const unpaid = (orders ?? []).filter((o) => !excludedOrders.has(o.id));
    if (!unpaid.length) continue; // nothing sold, or already covered by a manual weekly run

    const grossSales = unpaid.reduce((s, o) => s + o.base_amount, 0);
    const feeRate = organizer.is_platform_own ? 0 : organizer.commission_rate;
    const platformFee = Math.round(grossSales * feeRate * 100) / 100;
    const netPayable = Math.round((grossSales - platformFee) * 100) / 100;
    const processorFeeEstimate = unpaid.reduce(
      (s, o) => s + estimateProcessorFee(o.payment_provider, o.base_amount, o.base_currency),
      0
    );
    if (netPayable <= 0) continue;

    const { data: payout, error } = await service
      .from("payouts")
      .insert({
        organizer_id: organizer.id,
        event_id: event.id,
        period_start: event.starts_at,
        period_end: event.ends_at ?? event.starts_at,
        gross_sales: grossSales,
        platform_fee: platformFee,
        net_payable: netPayable,
        processor_fee_estimate: Math.round(processorFeeEstimate * 100) / 100,
        currency: organizer.payout_currency,
        status: "pending",
      })
      .select()
      .single();
    if (error || !payout) continue;

    await service
      .from("payout_items")
      .insert(unpaid.map((o) => ({ payout_id: payout.id, order_id: o.id, amount: o.base_amount })));

    created.push(payout.id);
  }

  return NextResponse.json({ created: created.length, payoutIds: created });
}
