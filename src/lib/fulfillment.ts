import { createServiceClient } from "@/lib/supabase/server";
import { generateTicketToken } from "@/lib/qrcode";
import { sendTicketEmail } from "@/lib/email";
import { generateCommunityMagicLink } from "@/lib/community";
import type { EventRow, OrderItem, TicketType } from "@/lib/types";

// Shared by the Paystack webhook (paid orders), the free-checkout path
// (zero-amount orders, which never touch Paystack), and the checkout
// success-page safety net (in case the webhook is slow/misconfigured).
// Order must already be marked "paid" before calling this. Idempotent —
// safe to call more than once for the same order, since the webhook and the
// success-page fallback can both race to fulfill the same order.
export async function fulfillOrder(orderId: string) {
  const supabase = createServiceClient();

  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).single();
  if (!order) return;

  const { data: orderItems } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", order.id)
    .returns<OrderItem[]>();

  // Already fulfilled by another caller (webhook vs. success-page safety net
  // racing each other) — skip so we don't double-issue tickets.
  const existingOrderItemIds = (orderItems ?? []).map((i) => i.id);
  if (existingOrderItemIds.length > 0) {
    const { count } = await supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .in("order_item_id", existingOrderItemIds);
    if (count && count > 0) return;
  }

  const { data: eventRow } = await supabase
    .from("events")
    .select("*")
    .eq("id", order.event_id)
    .single<EventRow>();

  const { data: organizerRow } = eventRow
    ? await supabase.from("organizers").select("business_name").eq("id", eventRow.organizer_id).single()
    : { data: null };

  const ticketsToInsert: { order_item_id: string; event_id: string; ticket_type_id: string; qr_token: string }[] = [];
  const ticketTypeNames: Record<string, string> = {};

  for (const item of orderItems ?? []) {
    // Capacity for this order was already reserved atomically at checkout
    // time (see reserve_ticket_types), so quantity_sold does not get
    // incremented again here — doing so would double-count it.
    const { data: tt } = await supabase
      .from("ticket_types")
      .select("*")
      .eq("id", item.ticket_type_id)
      .single<TicketType>();
    if (tt) {
      ticketTypeNames[tt.id] = tt.name;
    }
    for (let i = 0; i < item.quantity; i++) {
      ticketsToInsert.push({
        order_item_id: item.id,
        event_id: order.event_id,
        ticket_type_id: item.ticket_type_id,
        qr_token: generateTicketToken(),
      });
    }
  }

  const { data: insertedTickets } = await supabase
    .from("tickets")
    .insert(ticketsToInsert)
    .select();

  if (eventRow && insertedTickets) {
    // Community magic link is genuinely optional — never let it block ticket
    // delivery. Any failure here (email provisioning hiccup, etc.) just means
    // the "see updates" button is omitted from this email.
    let communityUrl: string | null = null;
    try {
      communityUrl = await generateCommunityMagicLink(order.buyer_email);
    } catch (err) {
      console.error(`[fulfillOrder] Community link failed for order ${order.id}:`, err);
    }

    // Fulfillment already succeeded and is recorded — don't let an email
    // failure bubble up and fail the whole checkout/webhook. Log it loudly
    // instead so it's visible in the terminal.
    try {
      await sendTicketEmail({
        to: order.buyer_email,
        buyerName: order.buyer_name,
        eventTitle: eventRow.title,
        eventDate: new Date(eventRow.starts_at).toLocaleString(undefined, {
          dateStyle: "full",
          timeStyle: "short",
        }),
        venue: `${eventRow.venue ?? ""} ${eventRow.city ?? ""}`.trim(),
        tickets: insertedTickets.map((t) => ({
          ticketTypeName: ticketTypeNames[t.ticket_type_id] ?? "Ticket",
          qrToken: t.qr_token,
        })),
        organizerName: organizerRow?.business_name ?? null,
        communityUrl,
      });
    } catch (err) {
      console.error(`[fulfillOrder] Ticket email failed for order ${order.id}:`, err);
    }
  }
}
