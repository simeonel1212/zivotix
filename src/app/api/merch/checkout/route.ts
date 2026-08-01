import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { resolveChargeCurrency, convert, toSubunit } from "@/lib/fx";
import { computeFees } from "@/lib/fees";
import { initTransaction } from "@/lib/paystack";
import { generateTicketToken } from "@/lib/qrcode";
import { appUrl } from "@/lib/app-url";
import { MERCH_REFERENCE_PREFIX, assessMerch, merchRefusalMessage, merchSubtotal } from "@/lib/merch";
import type { MerchProduct } from "@/lib/types";

// Buying merch.
//
// Same money path as tickets and passes — service fee on top, FX to the
// charge currency, Paystack hosted page — and deliberately its own route for
// the same reason memberships got one: what's being sold has different rules,
// and branching a working payment path on every line is how money bugs happen.

interface Body {
  productId: string;
  buyerName: string;
  buyerEmail: string;
  quantity: number;
  size?: string | null;
  fulfilment: "pickup" | "ship";
  shippingAddress?: string | null;
  shippingPhone?: string | null;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const supabase = createServiceClient();

  const buyerEmail = (body.buyerEmail ?? "").trim();
  const buyerName = (body.buyerName ?? "").trim();
  const quantity = Number(body.quantity) || 1;
  const fulfilment = body.fulfilment === "ship" ? "ship" : "pickup";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(buyerEmail)) {
    return NextResponse.json(
      { error: "Enter a valid email address, that's where your receipt goes." },
      { status: 400 }
    );
  }
  if (!buyerName) {
    return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  }

  const { data: product } = await supabase
    .from("merch_products")
    .select("*")
    .eq("id", body.productId)
    .maybeSingle<MerchProduct>();

  if (!product) {
    return NextResponse.json({ error: "That item isn't available" }, { status: 404 });
  }

  // Re-checked here rather than trusting the page. The browser's answer can be
  // minutes stale, and it's trivially bypassed — this is the one that counts.
  const state = assessMerch(product, { quantity, size: body.size, fulfilment });
  if (!state.buyable) {
    return NextResponse.json({ error: merchRefusalMessage(state.reason) }, { status: 409 });
  }

  const shippingAddress = fulfilment === "ship" ? (body.shippingAddress ?? "").trim() : null;
  if (fulfilment === "ship" && !shippingAddress) {
    return NextResponse.json({ error: "Enter a delivery address." }, { status: 400 });
  }

  const { subtotal } = merchSubtotal(product, quantity, fulfilment);
  const fees = computeFees(subtotal, product.currency, "pass");

  const chargeCurrency = resolveChargeCurrency(product.currency);
  let chargeAmount = fees.total;
  let rate: number | null = null;
  if (chargeCurrency !== product.currency) {
    const converted = await convert(fees.total, product.currency, chargeCurrency);
    chargeAmount = converted.amount;
    rate = converted.rate;
  }

  const reference = `${MERCH_REFERENCE_PREFIX}_${randomUUID()}`;

  const { data: order, error: insertError } = await supabase
    .from("merch_orders")
    .insert({
      organizer_id: product.organizer_id,
      product_id: product.id,
      buyer_name: buyerName,
      buyer_email: buyerEmail,
      quantity,
      size: body.size ?? null,
      fulfilment,
      shipping_address: shippingAddress,
      shipping_phone: fulfilment === "ship" ? (body.shippingPhone ?? "").trim() || null : null,
      base_currency: product.currency,
      base_amount: fees.organizerReceives,
      service_fee: fees.serviceFee,
      charge_currency: chargeCurrency,
      charge_amount: chargeAmount,
      fx_rate_used: rate,
      reference,
      // Pending until the return page verifies payment. Stock is only
      // decremented then — reserving it here would let an abandoned checkout
      // hold the last shirt hostage.
      status: "pending",
      // Only a collected order needs something to show at the door.
      pickup_token: fulfilment === "pickup" ? generateTicketToken() : null,
    })
    .select()
    .single();

  if (insertError || !order) {
    return NextResponse.json({ error: "Could not start that purchase" }, { status: 500 });
  }

  try {
    const tx = await initTransaction({
      email: buyerEmail,
      amount: toSubunit(chargeAmount),
      currency: chargeCurrency,
      reference,
      callback_url: `${appUrl()}/merch/${order.id}`,
      metadata: { merch_order_id: order.id, product_id: product.id },
      channels: ["card", "apple_pay"],
    });
    return NextResponse.json({ redirectUrl: tx.authorization_url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Payment init failed" },
      { status: 502 }
    );
  }
}
