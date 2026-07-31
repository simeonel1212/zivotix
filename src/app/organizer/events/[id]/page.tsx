import Link from "next/link";
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
import DeleteEventButton from "./delete-button";

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
  ticket_types: {
    name: string;
    category: string | null;
    description: string | null;
    price: number;
    quantity_total: number;
    max_per_order: number;
  }[];
}

function one<T>(rel: T | T[] | null): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}

// Sections an organizer can be looking at. The page used to be one continuous
// scroll — title, publish button, duplicate panel, three image editors, stats,
// ticket tiers, every ticket, every order. On a phone that's a wall you have to
// swipe through to find the one thing you came for.
//
// The tab lives in the URL so a back button and a bookmark both behave, and so
// nothing here needs to become a client component just to remember which
// section is open.
const TABS = [
  { key: "overview", label: "Overview" },
  { key: "tickets", label: "Tickets" },
  { key: "sales", label: "Sales" },
  { key: "settings", label: "Settings" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function OrganizerEventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: rawTab } = await searchParams;
  const tab: TabKey = (TABS.find((t) => t.key === rawTab)?.key ?? "overview") as TabKey;
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("*").eq("id", id).single<EventRow>();
  if (!event) return <p className="text-sm text-neutral-400">Event not found.</p>;

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
    .select("id, title, starts_at, currency, ticket_types(name, category, description, price, quantity_total, max_per_order)")
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

      {/* Horizontally scrollable so four tabs never wrap to a second line on a
          narrow phone, which is what made the old header feel disorganised. */}
      <div className="-mx-6 px-6 sm:mx-0 sm:px-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex items-center gap-1 border-b border-white/15 min-w-max">
          {TABS.map((t) => (
            <Tab
              key={t.key}
              href={`/organizer/events/${event.id}${t.key === "overview" ? "" : `?tab=${t.key}`}`}
              label={t.label}
              active={tab === t.key}
            />
          ))}
        </div>
      </div>

      {tab === "overview" && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Gross sales" value={`${grossSales.toLocaleString()} ${event.currency}`} accent />
            <Stat label="Tickets sold" value={String(ticketsSold)} />
            <Stat label="Orders" value={String((orders ?? []).length)} />
            <Stat label="Checked in" value={`${checkedInCount}/${(tickets ?? []).length}`} />
          </div>

          <CoverEditor eventId={event.id} initialUrl={event.cover_image_url ?? ""} />

          <LogoEditor eventId={event.id} initialUrl={event.logo_image_url ?? ""} />

          <GalleryEditor eventId={event.id} initialUrls={event.gallery_image_urls ?? []} />
        </>
      )}

      {tab === "tickets" && (
        <div>
          <h2 className="font-semibold text-neutral-50 mb-3">Ticket types</h2>
          <TicketTypesEditor
            eventId={event.id}
            ticketTypes={ticketTypes ?? []}
            currency={event.currency}
            templates={templates}
          />
        </div>
      )}

      {tab === "settings" && (
        <>
          <DuplicateButton eventId={event.id} title={event.title} startsAt={event.starts_at} />
          <DeleteEventButton eventId={event.id} title={event.title} />
        </>
      )}

      {tab === "sales" && (
      <>
      <div>
        <h2 className="font-semibold text-neutral-50 mb-3">
          Tickets & check-ins <span className="text-neutral-500 font-normal">(who&apos;s scanned in at the door)</span>
        </h2>
        {(!tickets || tickets.length === 0) ? (
          <div className="zv-card p-10 text-center">
            <p className="text-sm text-neutral-500">No tickets generated yet. They&apos;re created once an order is paid.</p>
          </div>
        ) : (
          <div className="zv-card divide-y divide-white/10 overflow-hidden">
            {tickets.map((t) => {
              const ticketType = one(t.ticket_types);
              const orderItem = one(t.order_items);
              const order = orderItem ? one(orderItem.orders) : null;
              const scanned = t.status === "used";
              return (
                <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-3.5 text-sm">
                  <div>
                    <p className="font-medium text-neutral-100">{order?.buyer_name ?? "Unknown buyer"}</p>
                    <p className="text-neutral-500">
                      {ticketType?.name ?? "Ticket"} · {order?.buyer_email}
                    </p>
                  </div>
                  {scanned ? (
                    <span className="zv-badge bg-emerald-500/15 text-emerald-300">
                      Checked in {t.checked_in_at ? new Date(t.checked_in_at).toLocaleTimeString() : ""}
                    </span>
                  ) : (
                    <span className="zv-badge bg-white/[0.08] text-neutral-400">Not yet scanned</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-semibold text-neutral-50 mb-3">Orders</h2>
        {(allOrders ?? []).length === 0 ? (
          <div className="zv-card p-10 text-center">
            <p className="text-sm text-neutral-500">No paid orders yet.</p>
          </div>
        ) : (
          <div className="zv-card divide-y divide-white/10 overflow-hidden">
            {allOrders!.map((o) => (
              <div key={o.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-3.5 text-sm">
                <div>
                  <p className="font-medium text-neutral-100">{o.buyer_name}</p>
                  <p className="text-neutral-500">{o.buyer_email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`font-medium ${o.status === "refunded" ? "text-neutral-500 line-through" : "text-neutral-200"}`}>
                    {o.base_amount.toLocaleString()} {o.base_currency}
                  </span>
                  {o.status === "refunded" ? (
                    <span className="zv-badge bg-red-500/15 text-red-300">Refunded</span>
                  ) : (
                    <RefundButton orderId={o.id} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}

function Tab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${
        active
          ? "border-neutral-900 text-neutral-50"
          : "border-transparent text-neutral-500 hover:text-neutral-200"
      }`}
    >
      {label}
    </Link>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="zv-card p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`text-lg font-bold mt-1 ${accent ? "zv-gradient-text" : "text-neutral-50"}`}>{value}</p>
    </div>
  );
}
