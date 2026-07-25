import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import { generateQrDataUrl } from "@/lib/qrcode";
import TicketCard from "@/components/ticket-card";

// Belt-and-braces with the /t/ Disallow in robots.ts: possession of this URL
// IS the credential, so it must never be indexed, cached by a search engine,
// or have a preview snippet generated for it.
export const metadata: Metadata = {
  title: "Your ticket",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

interface TicketRecord {
  id: string;
  status: "valid" | "used" | "void";
  qr_token: string;
  ticket_types: { name: string } | { name: string }[] | null;
  events:
    | { title: string; starts_at: string; venue: string | null; city: string | null; logo_image_url: string | null }
    | { title: string; starts_at: string; venue: string | null; city: string | null; logo_image_url: string | null }[]
    | null;
  order_items:
    | { orders: { buyer_name: string } | { buyer_name: string }[] | null }
    | { orders: { buyer_name: string } | { buyer_name: string }[] | null }[]
    | null;
}

function one<T>(rel: T | T[] | null): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}

// The designed ticket itself — this is the page a buyer's QR code links to,
// and what the ticket email points at. Token is unguessable, so possession
// of the URL is the credential (same model Megatix and Dice use).
export default async function TicketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: ticket } = await supabase
    .from("tickets")
    .select(
      "id, status, qr_token, ticket_types(name), events(title, starts_at, venue, city, logo_image_url), order_items(orders(buyer_name))"
    )
    .eq("qr_token", token)
    .single<TicketRecord>();

  if (!ticket) notFound();

  const event = one(ticket.events);
  const ticketType = one(ticket.ticket_types);
  const orderItem = one(ticket.order_items);
  const buyer = orderItem ? one(orderItem.orders) : null;
  const qrDataUrl = await generateQrDataUrl(ticket.qr_token);
  const ref = ticket.qr_token.slice(0, 8).toUpperCase();

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12">
      <TicketCard
        status={ticket.status}
        eventTitle={event?.title ?? ""}
        eventDateLabel={event ? new Date(event.starts_at).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" }) : ""}
        venue={event?.venue ?? null}
        city={event?.city ?? null}
        ticketTypeName={ticketType?.name ?? "General"}
        buyerName={buyer?.buyer_name}
        reference={ref}
        qrDataUrl={qrDataUrl}
        logoUrl={event?.logo_image_url}
      />
    </main>
  );
}
