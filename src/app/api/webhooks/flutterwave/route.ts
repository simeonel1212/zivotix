import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyFlutterwaveWebhookSignature } from "@/lib/flutterwave";
import { fulfillOrder } from "@/lib/fulfillment";

// Flutterwave webhook — only ever fires for the Apple Pay checkout path
// (see /api/checkout). Configure this URL (yourapp.com/api/webhooks/flutterwave)
// and a secret hash under Settings > Webhooks in the Flutterwave dashboard;
// the same secret hash goes in FLUTTERWAVE_SECRET_HASH here.
// Docs: https://developer.flutterwave.com/docs/webhooks
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("flutterwave-signature");

  const valid = await verifyFlutterwaveWebhookSignature(rawBody, signature);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  if (event.type !== "charge.completed" || event.data?.status !== "succeeded") {
    return NextResponse.json({ received: true });
  }

  const reference: string = event.data.reference;
  const supabase = createServiceClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("paystack_reference", reference)
    .eq("payment_provider", "flutterwave")
    .single();
  if (!order || order.status === "paid") {
    return NextResponse.json({ received: true }); // already processed / unknown ref
  }

  await supabase
    .from("orders")
    .update({ status: "paid", provider_charge_id: event.data.id ?? order.provider_charge_id })
    .eq("id", order.id);

  // Payment succeeded and is recorded — don't let a fulfillment hiccup turn
  // into a 500 (which would make Flutterwave retry the whole webhook).
  try {
    await fulfillOrder(order.id);
  } catch (err) {
    console.error(`[flutterwave webhook] Fulfillment failed for order ${order.id}:`, err);
  }

  return NextResponse.json({ received: true });
}
