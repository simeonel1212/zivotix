import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/app-url";
import ShareButton from "@/components/share-button";
import type { EventRow, Order, TicketType } from "@/lib/types";
import StatusToggle from "./status-toggle";
import CoverEditor from "./cover-editor";
import LogoEditor from "./logo-editor";
import GalleryEditor from "./gallery-editor";
import RefundButton from "./refund-button";
import EventEditForm from "./event-edit-form";
import TicketTypesEditor from "./ticket-types-editor";
import DuplicateButton from "./duplicate-button";

interface TicketRow {
  id: string;
  status: "valid" | "used" | "void";
  checked_in_at: string | null;
  ticket_types: { name: string } | { name: string }[] | null;
  order_items: {
    orders: { buyer_name: string; buyer_email: string } | { buyer_name: string; buyer_email: string }[] | null;
  } | {
    orders: { buyer_name: string; buyer_email: string } | { buyer_name: string; buyer_email: string }[] | null;
  }[] | null;
}

export interface TemplateEvent {
  id: string;
  title: string;
  starts_at: string;
  currency: string;
  ticket_types: { name: string; price: number; quantity_total: number; max_per_order: number }[];
}

function one<T>(rel: T | T[] | null): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}

export default async function OrganizerEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("*").eq("id", id).single<EventRow>();
  if (!event) return <p className="text-sm text-neutral-500">Event not found.</p>;

  const { data: ticketTypes } = await supabase
    .from("ticket_types")
    .select("*")
    .eq("event_id", id)
    .returns<TicketType[]>();

  // The organizer's other events, with their ticket tiers, so this event can
  // reuse a pricing structure instead of retyping "Early bird / Regular / VIP"
  // every month. RLS scopes this to events they own.
  const { data: otherEvents } = await supabase
    .from("events")
    .select("id, title, starts_at, currency, ticket_types(name, price, quantity_total, max_per_order)")
    .eq("organizer_id", event.organizer_id)
    .neq("id", id)
    .order("starts_at", { ascending: false })
    .limit(20)
    .returns<TemplateEvent[]>();

  // An event with no tiers is useless as a template.
  const templates = (otherEvents ?? []).filter((e) => (e.ticket_types ?? []).length > 0);

  const { data: allOrders } = await supabase
    .from("orders")
    .select("*")
    .eq("event_id", id)
    .in("status", ["paid", "refunded"])
    .order("created_at", { ascending: false })
    .returns<Order[]>();

  const orders = (allOrders ?? []).filter((o) => o.status === "paid");

  const { data: tickets } = await supabase
    .from("tickets")
    .select("id, status, checked_in_at, ticket_types(name), order_items(orders(buyer_name, buyer_email))")
    .eq("event_id", id)
    .order("checked_in_at", { ascending: false, nullsFirst: false })
    .returns<TicketRow[]>();

  const grossSales = (orders ?? []).reduce((s, o) => s + o.base_amount, 0);
  const ticketsSold = (ticketTypes ?? []).reduce((s, tt) => s + tt.quantity_sold, 0);
  const checkedInCount = (tickets ?? []).filter((t) => t.status === "used").length;

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <EventEditForm
        event={event}
        headerActions={
          <>
            {/* Shares the public event URL, not this dashboard page. This is
                where an organizer actually comes looking for their link. */}
            {event.status === "published" && (
              <ShareButton
                title={event.title}
                text={`${event.title} — ${new Date(event.starts_at).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "long",
                })} at ${event.venue}, ${event.city}. Tickets:`}
                url={`${appUrl()}/events/${event.slug}`}
                label="Share link"
              />
            )}
            <StatusToggle eventId={event.id} status={event.status} />
          </>
        }
      />

      {/* Below the header rather than inside it: the panel expands, and a
          growing card inside a header row shoves the title around. */}
      <DuplicateButton eventId={event.id} title={event.title} startsAt={event.starts_at} />

      <CoverEditor eventId={event.id} initialUrl={event.cover_image_url ?? ""} />

      <LogoEditor eventId={event.id} initialUrl={event.logo_image_url ?? ""} />

      <GalleryEditor eventId={event.id} initialUrls={event.gallery_image_urls ?? []} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Gross sales" value={`${grossSales.toLocaleString()} ${event.currency}`} accent />
        <Stat label="Tickets sold" value={String(ticketsSold)} />
        <Stat label="Orders" value={String((orders ?? []).length)} />
        <Stat label="Checked in" value={`${checkedInCount}/${(tickets ?? []).length}`} />
      </div>

      <div>
        <h2 className="font-semibold text-neutral-900 mb-3">Ticket types</h2>
        <TicketTypesEditor
          eventId={event.id}
          ticketTypes={ticketTypes ?? []}
          currency={event.currency}
          templates={templates}
        />
      </div>

      <div>
        <h2 className="font-semibold text-neutral-900 mb-3">
          Tickets & check-ins <span className="text-neutral-400 font-normal">(who&apos;s scanned in at the door)</span>
        </h2>
        {(!tickets || tickets.length === 0) ? (
          <div className="zv-card p-10 text-center">
            <p className="text-sm text-neutral-400">No tickets generated yet. They&apos;re created once an order is paid.</p>
          </div>
        ) : (
          <div className="zv-card divide-y divide-neutral-100 overflow-hidden">
            {tickets.map((t) => {
              const ticketType = one(t.ticket_types);
              const orderItem = one(t.order_items);
              const order = orderItem ? one(orderItem.orders) : null;
              const scanned = t.status === "used";
              return (
                <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-3.5 text-sm">
                  <div>
                    <p className="font-medium text-neutral-800">{order?.buyer_name ?? "Unknown buyer"}</p>
                    <p className="text-neutral-400">
                      {ticketType?.name ?? "Ticket"} · {order?.buyer_email}
                    </p>
                  </div>
                  {scanned ? (
                    <span className="zv-badge bg-emerald-100 text-emerald-700">
                      Checked in {t.checked_in_at ? new Date(t.checked_in_at).toLocaleTimeString() : ""}
                    </span>
                  ) : (
                    <span className="zv-badge bg-neutral-100 text-neutral-500">Not yet scanned</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-semibold text-neutral-900 mb-3">Orders</h2>
        {(allOrders ?? []).length === 0 ? (
          <div className="zv-card p-10 text-center">
            <p className="text-sm text-neutral-400">No paid orders yet.</p>
          </div>
        ) : (
          <div className="zv-card divide-y divide-neutral-100 overflow-hidden">
            {allOrders!.map((o) => (
              <div key={o.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-3.5 text-sm">
                <div>
                  <p className="font-medium text-neutral-800">{o.buyer_name}</p>
                  <p className="text-neutral-400">{o.buyer_email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`font-medium ${o.status === "refunded" ? "text-neutral-400 line-through" : "text-neutral-700"}`}>
                    {o.base_amount.toLocaleString()} {o.base_currency}
                  </span>
                  {o.status === "refunded" ? (
                    <span className="zv-badge bg-red-100 text-red-700">Refunded</span>
                  ) : (
                    <RefundButton orderId={o.id} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="zv-card p-4">
      <p className="text-xs text-neutral-400">{label}</p>
      <p className={`text-lg font-bold mt-1 ${accent ? "zv-gradient-text" : "text-neutral-900"}`}>{value}</p>
    </div>
  );
}
