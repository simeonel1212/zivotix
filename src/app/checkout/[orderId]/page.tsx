import { createServiceClient } from "@/lib/supabase/server";
import { verifyTransaction } from "@/lib/paystack";
import { getCharge } from "@/lib/flutterwave";
import { generateQrDataUrl } from "@/lib/qrcode";
import { fulfillOrder } from "@/lib/fulfillment";
import TicketCard from "@/components/ticket-card";
import ConfettiBurst from "@/components/confetti-burst";
import type { EventRow } from "@/lib/types";

interface TicketWithType {
  id: string;
  status: "valid" | "used" | "void";
  qr_token: string;
  ticket_types: { name: string } | { name: string }[] | null;
}

function one<T>(rel: T | T[] | null): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}

// Paystack redirects the buyer here after payment (and free checkouts land
// here directly too). The webhook is the source of truth for fulfillment
// (ticket generation + email), but we also verify here so the buyer isn't
// stuck looking at "pending" if the webhook is slow — and once paid, we show
// the same branded ticket graphic that's emailed out, not just a QR/receipt.
export default async function CheckoutStatusPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const supabase = createServiceClient();

  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).single();

  if (order && order.status === "pending" && order.paystack_reference) {
    try {
      // Webhook is the primary path and usually wins this race, but if it's
      // slow (or misconfigured), fulfill right here so the buyer isn't stuck
      // on "processing" with no tickets ever generated. fulfillOrder() is
      // idempotent, so it's safe if the webhook also fires around the same time.
      const succeeded =
        order.payment_provider === "flutterwave" && order.provider_charge_id
          ? (await getCharge(order.provider_charge_id)).status === "succeeded"
          : (await verifyTransaction(order.paystack_reference)).status === "success";

      if (succeeded) {
        await supabase.from("orders").update({ status: "paid" }).eq("id", order.id);
        await fulfillOrder(order.id);
      }
    } catch {
      // Ignore — webhook remains the source of truth.
    }
  }

  const { data: refreshed } = await supabase.from("orders").select("*").eq("id", orderId).single();
  const paid = refreshed?.status === "paid";

  let ticketCards: React.ReactNode[] = [];
  if (paid && refreshed) {
    const { data: event } = await supabase.from("events").select("*").eq("id", refreshed.event_id).single<EventRow>();

    const { data: orderItems } = await supabase.from("order_items").select("id").eq("order_id", refreshed.id);
    const orderItemIds = (orderItems ?? []).map((oi) => oi.id);

    const { data: tickets } =
      orderItemIds.length > 0
        ? await supabase
            .from("tickets")
            .select("id, status, qr_token, ticket_types(name)")
            .in("order_item_id", orderItemIds)
            .returns<TicketWithType[]>()
        : { data: [] as TicketWithType[] };

    if (event && tickets) {
      ticketCards = await Promise.all(
        tickets.map(async (t, i) => {
          const ticketType = one(t.ticket_types);
          const qrDataUrl = await generateQrDataUrl(t.qr_token);
          return (
            <div key={t.id} className="zv-pop-in" style={{ animationDelay: `${i * 90}ms` }}>
              <TicketCard
                status={t.status}
                eventTitle={event.title}
                eventDateLabel={new Date(event.starts_at).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}
                venue={event.venue}
                city={event.city}
                ticketTypeName={ticketType?.name ?? "General"}
                buyerName={refreshed.buyer_name}
                reference={t.qr_token.slice(0, 8).toUpperCase()}
                qrDataUrl={qrDataUrl}
                logoUrl={event.logo_image_url}
              />
            </div>
          );
        })
      );
    }
  }

  if (paid && ticketCards.length > 0) {
    return (
      <main className="flex-1 px-6 py-12 relative overflow-hidden">
        <ConfettiBurst />
        <div
          className="zv-glow-orb w-[28rem] h-[28rem] -top-32 -left-32"
          style={{ background: "linear-gradient(135deg, #facc15, #ca8a04)" }}
        />
        <div
          className="zv-glow-orb w-[24rem] h-[24rem] bottom-0 right-0"
          style={{ background: "linear-gradient(135deg, #fde047, #eab308)" }}
        />
        <div className="relative max-w-sm mx-auto text-center mb-8 zv-pop-in">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-50">You&apos;re in!</h1>
          <p className="mt-2 text-neutral-400 text-sm leading-relaxed">
            {ticketCards.length > 1 ? "Here are your tickets" : "Here's your ticket"}, also emailed to {refreshed?.buyer_email}.
          </p>
        </div>
        <div className="relative space-y-8">{ticketCards}</div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 relative overflow-hidden">
      {paid && <ConfettiBurst />}
      <div
        className="zv-glow-orb w-[28rem] h-[28rem] -top-32 -left-32"
        style={{ background: "linear-gradient(135deg, #facc15, #ca8a04)" }}
      />
      <div
        className="zv-glow-orb w-[24rem] h-[24rem] bottom-0 right-0"
        style={{ background: "linear-gradient(135deg, #fde047, #eab308)" }}
      />

      <div className={`zv-card relative max-w-sm w-full text-center space-y-4 p-10 ${paid ? "zv-pop-in" : ""}`}>
        <div
          className={`mx-auto h-16 w-16 rounded-full flex items-center justify-center ${
            paid ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-white" : "bg-white/[0.08] text-neutral-500"
          }`}
        >
          {paid ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-50">
          {paid ? "You're in!" : "Payment processing…"}
        </h1>
        <p className="text-neutral-400 text-sm leading-relaxed">
          {paid
            ? `Your tickets have been emailed to ${refreshed?.buyer_email}. Check your inbox (and spam folder).`
            : "This can take a minute. Refresh this page shortly, or check your email. We'll send your tickets as soon as payment clears."}
        </p>
      </div>
    </main>
  );
}
