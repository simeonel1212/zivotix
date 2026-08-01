import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { computeFees } from "@/lib/fees";
import { startPayment } from "@/lib/start-payment";
import { buyerCountry } from "@/lib/geo";
import { fulfillOrder } from "@/lib/fulfillment";
import { appUrl } from "@/lib/app-url";
import type { EventRow, TicketType } from "@/lib/types";

interface CheckoutBody {
  eventId: string;
  buyerName: string;
  buyerEmail: string;
  items: { ticketTypeId: string; quantity: number }[];
  /** Set when the buyer tapped Apple Pay rather than the card button. */
  wallet?: "applepay";
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

  // Purely alphanumeric reference. Paystack doesn't care either way, but
  // Flutterwave does, and it is the same reference on both rails.
  const reference = `zvx${randomUUID().replace(/-/g, "")}`;

  // Zivotix's revenue is the service fee, and the buyer always pays it on top
  // of the organizer's listed price. It used to be a per-event choice; that
  // was a decision organizers had no reason to make and every reason to get
  // wrong, so the answer is now the same everywhere and stated at checkout.
  const fees = computeFees(baseAmount, event.currency, "pass");

  // The order is written before the processor is called because the payment
  // page has to redirect back to /checkout/{order.id}, so the id must exist
  // first. Charge columns are seeded with the event's own currency and
  // corrected below once we know which processor took it and at what rate —
  // the alternative, guessing the currency here, is the shape of the bug that
  // caused the 1 August outage.
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      event_id: event.id,
      buyer_name: buyerName,
      buyer_email: buyerEmail,
      base_currency: event.currency,
      // What the organizer is owed — face value under "pass", face value
      // minus the fee under "absorb". Payouts sum this column, so it must
      // never include our service fee.
      base_amount: fees.organizerReceives,
      service_fee: fees.serviceFee,
      charge_currency: event.currency,
      charge_amount: fees.total,
      fx_rate_used: 1,
      paystack_reference: reference,
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

  try {
    const started = await startPayment({
      // The buyer's full total, fee included — the fee is charged in the same
      // currency as the tickets, not tacked on afterwards in naira.
      amount: fees.total,
      currency: event.currency,
      reference,
      buyer: { email: buyerEmail, name: buyerName },
      redirectUrl: `${appUrl()}/checkout/${order.id}`,
      buyerCountry: await buyerCountry(),
      wallet: body.wallet === "applepay" ? "applepay" : undefined,
      title: event.title,
      logo: event.logo_image_url,
      meta: { order_id: order.id, event_id: event.id },
    });

    await supabase
      .from("orders")
      .update({
        payment_provider: started.provider,
        charge_currency: started.chargeCurrency,
        charge_amount: started.chargeAmount,
        fx_rate_used: started.fxRate,
        // Only the wallet path produces one. The return page checks it first
        // and verifies that charge directly instead of looking up by reference.
        ...(started.providerChargeId ? { provider_charge_id: started.providerChargeId } : {}),
      })
      .eq("id", order.id);

    return NextResponse.json({ redirectUrl: started.paymentUrl });
  } catch (e) {
    // Both rails refused right after we reserved capacity for this order —
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
