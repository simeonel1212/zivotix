import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyWebhookSignature } from "@/lib/paystack";
import { fulfillOrder } from "@/lib/fulfillment";

// Paystack webhook: https://paystack.com/docs/payments/webhooks/
// Configure this URL (yourapp.com/api/paystack/webhook) in the Paystack dashboard.
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  const valid = await verifyWebhookSignature(rawBody, signature);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const supabase = createServiceClient();

  // Async resolution of a payout transfer initiated from /admin/payouts —
  // "pending"/"otp" transfers land here once Paystack finishes processing
  // (or the OTP is confirmed in their dashboard).
  if (event.event === "transfer.success" || event.event === "transfer.failed" || event.event === "transfer.reversed") {
    const transferReference: string = event.data.reference;
    const { data: payout } = await supabase
      .from("payouts")
      .select("id, status")
      .eq("reference", transferReference)
      .single();

    if (payout && payout.status !== "paid") {
      if (event.event === "transfer.success") {
        await supabase.from("payouts").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", payout.id);
      } else {
        await supabase.from("payouts").update({ status: "failed" }).eq("id", payout.id);
      }
    }
    return NextResponse.json({ received: true });
  }

  if (event.event !== "charge.success") {
    return NextResponse.json({ received: true });
  }

  const reference: string = event.data.reference;

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("paystack_reference", reference)
    .single();
  if (!order || order.status === "paid") {
    return NextResponse.json({ received: true }); // already processed / unknown ref
  }

  // Mark the order paid
  await supabase.from("orders").update({ status: "paid" }).eq("id", order.id);

  // Payment succeeded and is recorded — don't let a fulfillment hiccup turn
  // into a 500 (which would make Paystack retry the whole webhook).
  try {
    await fulfillOrder(order.id);
  } catch (err) {
    console.error(`[paystack webhook] Fulfillment failed for order ${order.id}:`, err);
  }

  return NextResponse.json({ received: true });
}
