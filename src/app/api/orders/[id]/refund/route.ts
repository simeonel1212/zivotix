import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { refundTransaction } from "@/lib/paystack";
import { refundCharge } from "@/lib/flutterwave";
import { refundFlutterwaveTransaction } from "@/lib/flutterwave-v3";
import type { Order, OrderItem } from "@/lib/types";

// Refunds a paid order via Paystack, voids its tickets so they can't be
// scanned in at the door, and frees up the capacity they held. Callable by
// the organizer who owns the event, or an admin.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  const service = createServiceClient();

  const { data: order } = await service.from("orders").select("*").eq("id", id).single<Order>();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status !== "paid") {
    return NextResponse.json({ error: `Can't refund an order with status "${order.status}"` }, { status: 400 });
  }

  // Authorization: admin, or the organizer who owns the event this order belongs to.
  if (profile?.role !== "admin") {
    const { data: event } = await service.from("events").select("organizer_id").eq("id", order.event_id).single();
    const { data: organizer } = await service
      .from("organizers")
      .select("id")
      .eq("profile_id", user.id)
      .single();
    if (!event || !organizer || event.organizer_id !== organizer.id) {
      return NextResponse.json({ error: "Not authorized to refund this order" }, { status: 403 });
    }
  }

  // Free orders never touched a payment provider, so there's nothing to
  // refund there — just cancel the registration and void the tickets below.
  if (order.base_amount > 0) {
    if (order.payment_provider === "flutterwave") {
      if (!order.provider_charge_id) {
        return NextResponse.json({ error: "Order has no Flutterwave charge to refund" }, { status: 400 });
      }
      try {
        // Two Flutterwave rails, two id formats. v4 charge ids are prefixed
        // ("chg_…"); v3 hosted-checkout transaction ids are plain numbers. The
        // prefix is the only thing that distinguishes them, and calling the
        // wrong endpoint fails with a confusing "transaction not found" rather
        // than anything that points at the real problem.
        if (order.provider_charge_id.startsWith("chg_")) {
          await refundCharge(order.provider_charge_id, order.charge_amount, "Order cancelled");
        } else {
          await refundFlutterwaveTransaction(order.provider_charge_id, order.charge_amount);
        }
      } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Refund failed" }, { status: 502 });
      }
    } else {
      if (!order.paystack_reference) {
        return NextResponse.json({ error: "Order has no payment reference to refund" }, { status: 400 });
      }
      try {
        await refundTransaction(order.paystack_reference);
      } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Refund failed" }, { status: 502 });
      }
    }
  }

  await service.from("orders").update({ status: "refunded" }).eq("id", order.id);

  const { data: orderItems } = await service
    .from("order_items")
    .select("*")
    .eq("order_id", order.id)
    .returns<OrderItem[]>();

  for (const item of orderItems ?? []) {
    // Void every ticket generated for this order item so it can't be scanned in.
    await service.from("tickets").update({ status: "void" }).eq("order_item_id", item.id);

    // Free up the capacity this order held.
    const { data: tt } = await service
      .from("ticket_types")
      .select("quantity_sold")
      .eq("id", item.ticket_type_id)
      .single();
    if (tt) {
      await service
        .from("ticket_types")
        .update({ quantity_sold: Math.max(0, tt.quantity_sold - item.quantity) })
        .eq("id", item.ticket_type_id);
    }
  }

  return NextResponse.json({ ok: true });
}
