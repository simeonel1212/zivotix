import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { resolveChargeCurrency, convert, toSubunit } from "@/lib/fx";
import { initTransaction } from "@/lib/paystack";
import { createFlutterwaveCustomer, createApplePayPaymentMethod, createCharge } from "@/lib/flutterwave";
import { fulfillOrder } from "@/lib/fulfillment";
import { appUrl } from "@/lib/app-url";
import type { EventRow, TicketType } from "@/lib/types";

interface CheckoutBody {
  eventId: string;
  buyerName: string;
  buyerEmail: string;
  items: { ticketTypeId: string; quantity: number }[];
  // Everything defaults to Paystack. The exception is Apple Pay, which
  // Paystack doesn't support on this account — the client only sends this
  // when it has already confirmed the browser can show the Apple Pay sheet
  // (see ticket-selector.tsx), so this never affects other buyers.
  // Google Pay was built (see flutterwave.ts) but is pulled from checkout
  // for now — Flutterwave hasn't enabled it on this merchant account yet.
  provider?: "paystack" | "flutterwave_applepay";
}

export async function POST(req: Request) {
  const body = (await req.json()) as CheckoutBody;
  const supabase = createServiceClient();

  if (!body.items?.length) {
    return NextResponse.json({ error: "No tickets selected" }, { status: 400 });
  }

  // The buyer's email is the only way their ticket reaches them, and it's
  // also what Flutterwave requires to create a customer. Without this check a
  // value like "simeon" creates a real paid order whose ticket can never be
  // delivered — which has already happened in production.
  const buyerEmail = (body.buyerEmail ?? "").trim();
  const buyerName = (body.buyerName ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(buyerEmail)) {
    return NextResponse.json(
      { error: "Enter a valid email address, that's where your ticket is sent." },
      { status: 400 }
    );
  }
  if (!buyerName) {
    return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  }

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", body.eventId)
    .eq("status", "published")
    .single<EventRow>();
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const ticketTypeIds = body.items.map((i) => i.ticketTypeId);
  const { data: ticketTypes } = await supabase
    .from("ticket_types")
    .select("*")
    .in("id", ticketTypeIds)
    .returns<TicketType[]>();
  if (!ticketTypes || ticketTypes.length !== ticketTypeIds.length) {
    return NextResponse.json({ error: "Invalid ticket selection" }, { status: 400 });
  }

  // Basic per-item validation + compute base total (in the event's native
  // currency). Real availability is enforced atomically by reserve_ticket_types
  // below — a plain "quantity_total - quantity_sold" read here would be stale
  // by the time this request's write lands, letting concurrent buyers both
  // pass the check for the same last few tickets.
  let baseAmount = 0;
  for (const item of body.items) {
    const tt = ticketTypes.find((t) => t.id === item.ticketTypeId)!;
    if (item.quantity < 1 || item.quantity > tt.max_per_order) {
      return NextResponse.json({ error: `Invalid quantity for "${tt.name}"` }, { status: 400 });
    }
    baseAmount += tt.price * item.quantity;
  }

  // Release any abandoned reservations for this event (started checkout,
  // never paid) before attempting to reserve capacity for this order.
  await supabase.rpc("release_expired_orders", { p_event_id: event.id, p_minutes: 20 });

  const reservationItems = body.items.map((item) => ({
    ticket_type_id: item.ticketTypeId,
    quantity: item.quantity,
  }));
  const { error: reserveError } = await supabase.rpc("reserve_ticket_types", {
    p_items: reservationItems,
  });
  if (reserveError) {
    if (reserveError.message?.startsWith("SOLD_OUT")) {
      return NextResponse.json(
        { error: "Sorry, someone just grabbed the last of those tickets. Please try a smaller quantity." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Could not reserve tickets" }, { status: 500 });
  }

  // Free order (every selected ticket type is priced at 0): skip Paystack
  // entirely, there's nothing to charge. Mark it paid straight away and
  // fulfill it so the buyer gets their QR tickets immediately.
  if (baseAmount === 0) {
    const reference = `zvx_free_${randomUUID()}`;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        event_id: event.id,
        buyer_name: buyerName,
        buyer_email: buyerEmail,
        base_currency: event.currency,
        base_amount: 0,
        charge_currency: event.currency,
        charge_amount: 0,
        fx_rate_used: 1,
        paystack_reference: reference,
        status: "paid",
      })
      .select()
      .single();
    if (orderError || !order) {
      await supabase.rpc("release_ticket_types", { p_items: reservationItems });
      return NextResponse.json({ error: "Could not create order" }, { status: 500 });
    }

    await supabase.from("order_items").insert(
      body.items.map((item) => {
        const tt = ticketTypes.find((t) => t.id === item.ticketTypeId)!;
        return {
          order_id: order.id,
          ticket_type_id: tt.id,
          quantity: item.quantity,
          unit_price: tt.price,
          subtotal: 0,
        };
      })
    );

    await fulfillOrder(order.id);

    return NextResponse.json({ redirectUrl: `${appUrl()}/checkout/${order.id}` });
  }

  // Work out what currency Paystack will actually charge in, converting if
  // needed. Events can be priced in any world currency (see WORLD_CURRENCIES),
  // but Paystack itself only ever charges the card in NGN or USD — so this
  // conversion is what makes "any currency in, smooth card charge out" work.
  const chargeCurrency = resolveChargeCurrency(event.currency);
  let chargeAmount: number;
  let rate: number;
  try {
    ({ amount: chargeAmount, rate } = await convert(baseAmount, event.currency, chargeCurrency));
  } catch {
    await supabase.rpc("release_ticket_types", { p_items: reservationItems });
    return NextResponse.json(
      { error: `Couldn't convert ${event.currency} to ${chargeCurrency} right now. Please try again shortly.` },
      { status: 502 }
    );
  }

  // Flutterwave requires the charge reference to be purely alphanumeric
  // (no hyphens/underscores) — Paystack doesn't care either way, so this
  // stripped form is used for both providers to keep a single source of truth.
  const reference = `zvx${randomUUID().replace(/-/g, "")}`;
  const wallet = body.provider === "flutterwave_applepay" ? body.provider : null;
  const provider = wallet ? "flutterwave" : "paystack";

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      event_id: event.id,
      buyer_name: buyerName,
      buyer_email: buyerEmail,
      base_currency: event.currency,
      base_amount: baseAmount,
      charge_currency: chargeCurrency,
      charge_amount: chargeAmount,
      fx_rate_used: rate,
      paystack_reference: reference,
      payment_provider: provider,
      status: "pending",
    })
    .select()
    .single();
  if (orderError || !order) {
    await supabase.rpc("release_ticket_types", { p_items: reservationItems });
    return NextResponse.json({ error: "Could not create order" }, { status: 500 });
  }

  await supabase.from("order_items").insert(
    body.items.map((item) => {
      const tt = ticketTypes.find((t) => t.id === item.ticketTypeId)!;
      return {
        order_id: order.id,
        ticket_type_id: tt.id,
        quantity: item.quantity,
        unit_price: tt.price,
        subtotal: tt.price * item.quantity,
      };
    })
  );

  if (wallet) {
    try {
      const customer = await createFlutterwaveCustomer({ email: buyerEmail, name: buyerName });
      const paymentMethod = await createApplePayPaymentMethod(buyerName);
      const charge = await createCharge({
        customerId: customer.id,
        paymentMethodId: paymentMethod.id,
        amount: chargeAmount,
        currency: chargeCurrency,
        reference,
        redirectUrl: `${appUrl()}/checkout/${order.id}`,
        meta: { order_id: order.id, event_id: event.id },
      });
      await supabase.from("orders").update({ provider_charge_id: charge.id }).eq("id", order.id);

      const redirectUrl = charge.next_action?.redirect_url.url;
      if (!redirectUrl) throw new Error("Flutterwave didn't return an Apple Pay redirect");
      return NextResponse.json({ redirectUrl });
    } catch (e) {
      await supabase.rpc("release_ticket_types", { p_items: reservationItems });
      await supabase.from("orders").update({ status: "failed" }).eq("id", order.id);
      // Every Apple Pay attempt so far has failed here with the reason only
      // ever reaching the browser, so log the full context server-side. The
      // usual causes are Apple Pay not being enabled on the Flutterwave
      // merchant account, or the charge currency not being supported for it.
      console.error("[checkout] Apple Pay failed", {
        orderId: order.id,
        chargeCurrency,
        chargeAmount,
        reference,
        error: e instanceof Error ? e.message : String(e),
      });
      return NextResponse.json(
        {
          error:
            e instanceof Error
              ? `Apple Pay couldn't start: ${e.message}`
              : "Apple Pay init failed",
        },
        { status: 502 }
      );
    }
  }

  try {
    const tx = await initTransaction({
      email: buyerEmail,
      amount: toSubunit(chargeAmount),
      currency: chargeCurrency,
      reference,
      callback_url: `${appUrl()}/checkout/${order.id}`,
      metadata: { order_id: order.id, event_id: event.id },
      channels: ["card"],
    });
    return NextResponse.json({ redirectUrl: tx.authorization_url });
  } catch (e) {
    // Paystack init failed right after we reserved capacity for this order —
    // release it immediately rather than making it wait out the 20-minute
    // abandoned-reservation cleanup.
    await supabase.rpc("release_ticket_types", { p_items: reservationItems });
    await supabase.from("orders").update({ status: "failed" }).eq("id", order.id);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Payment init failed" },
      { status: 502 }
    );
  }
}
