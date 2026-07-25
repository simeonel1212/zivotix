import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyFlutterwaveWebhookSignature } from "@/lib/flutterwave";
import { fulfillOrder } from "@/lib/fulfillment";

// Flutterwave webhook — fires for the Apple Pay checkout path (see
// /api/checkout). Cards go through Paystack, including international ones.
//
// Configure this URL (yourapp.com/api/webhooks/flutterwave) and a secret hash
// under Settings > Webhooks in the Flutterwave dashboard; the same secret
// hash goes in FLUTTERWAVE_SECRET_HASH here.
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

  const reference: string | undefined = event.data?.reference;
  if (!reference) {
    console.error("[flutterwave webhook] charge.completed with no reference", event.data);
    return NextResponse.json({ received: true });
  }

  const supabase = createServiceClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("paystack_reference", reference)
    .eq("payment_provider", "flutterwave")
    .maybeSingle();
  if (!order || order.status === "paid") {
    return NextResponse.json({ received: true }); // already processed / unknown ref
  }

  // Never take the webhook's word for the amount. A charge that succeeded for
  // less than the ticket price, or in a different currency, must not issue a
  // ticket.
  const paidAmount = Number(event.data?.amount);
  const paidCurrency: string | undefined = event.data?.currency;
  const amountMatches =
    Number.isFinite(paidAmount) && Math.abs(paidAmount - Number(order.charge_amount)) < 0.01;
  const currencyMatches = !paidCurrency || paidCurrency === order.charge_currency;

  if (!amountMatches || !currencyMatches) {
    console.error("[flutterwave webhook] amount/currency mismatch, not fulfilling", {
      orderId: order.id,
      expected: { amount: order.charge_amount, currency: order.charge_currency },
      received: { amount: paidAmount, currency: paidCurrency },
    });
    return NextResponse.json({ received: true });
  }

  await supabase
    .from("orders")
    .update({
      status: "paid",
      provider_charge_id: event.data?.id ? String(event.data.id) : order.provider_charge_id,
    })
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
