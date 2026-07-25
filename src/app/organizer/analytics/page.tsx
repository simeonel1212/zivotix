import { createClient } from "@/lib/supabase/server";
import type { EventRow, Order, OrderItem } from "@/lib/types";

interface OrderItemWithType extends OrderItem {
  ticket_types: { name: string } | { name: string }[] | null;
}

function one<T>(rel: T | T[] | null): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? rel[0] ?? null : rel;
}

export default async function OrganizerAnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: organizer } = await supabase
    .from("organizers")
    .select("*")
    .eq("profile_id", user!.id)
    .single();

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("organizer_id", organizer?.id)
    .returns<EventRow[]>();

  const eventIds = (events ?? []).map((e) => e.id);
  const eventTitleById = new Map((events ?? []).map((e) => [e.id, e.title]));
  const currency = organizer?.payout_currency ?? "NGN";

  const { data: orders } = eventIds.length
    ? await supabase
        .from("orders")
        .select("*")
        .in("event_id", eventIds)
        .eq("status", "paid")
        .returns<Order[]>()
    : { data: [] as Order[] };

  const orderIds = (orders ?? []).map((o) => o.id);

  const { data: orderItems } = orderIds.length
    ? await supabase
        .from("order_items")
        .select("*, ticket_types(name)")
        .in("order_id", orderIds)
        .returns<OrderItemWithType[]>()
    : { data: [] as OrderItemWithType[] };

  // --- Overall stats ---
  const totalRevenue = (orders ?? []).reduce((s, o) => s + o.base_amount, 0);
  const totalTickets = (orderItems ?? []).reduce((s, oi) => s + oi.quantity, 0);
  const avgOrderValue = orders?.length ? totalRevenue / orders.length : 0;

  // --- Sales over the last 14 days ---
  const days: { label: string; date: string; revenue: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    days.push({ label: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }), date, revenue: 0 });
  }
  const dayIndex = new Map(days.map((d, i) => [d.date, i]));
  for (const o of orders ?? []) {
    const date = o.created_at.slice(0, 10);
    const idx = dayIndex.get(date);
    if (idx !== undefined) days[idx].revenue += o.base_amount;
  }
  const maxDayRevenue = Math.max(1, ...days.map((d) => d.revenue));

  // --- Revenue by ticket type ---
  const byType = new Map<string, { revenue: number; quantity: number }>();
  for (const oi of orderItems ?? []) {
    const name = one(oi.ticket_types)?.name ?? "Ticket";
    const existing = byType.get(name) ?? { revenue: 0, quantity: 0 };
    existing.revenue += oi.subtotal;
    existing.quantity += oi.quantity;
    byType.set(name, existing);
  }
  const typeBreakdown = [...byType.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue);
  const maxTypeRevenue = Math.max(1, ...typeBreakdown.map((t) => t.revenue));

  // --- Revenue by event ---
  const byEvent = new Map<string, number>();
  for (const o of orders ?? []) {
    byEvent.set(o.event_id, (byEvent.get(o.event_id) ?? 0) + o.base_amount);
  }
  const eventBreakdown = [...byEvent.entries()]
    .map(([eventId, revenue]) => ({ eventId, title: eventTitleById.get(eventId) ?? "Untitled event", revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);
  const maxEventRevenue = Math.max(1, ...eventBreakdown.map((e) => e.revenue));

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Analytics</h1>
        <p className="text-sm text-neutral-500 mt-1">How your sales are trending across every event you run.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Stat label="Total revenue" value={`${totalRevenue.toLocaleString()} ${currency}`} accent />
        <Stat label="Tickets sold" value={String(totalTickets)} />
        <Stat label="Avg. order value" value={`${avgOrderValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`} />
      </div>

      <div>
        <h2 className="font-semibold text-neutral-900 mb-3">Sales in the last 14 days</h2>
        {totalRevenue === 0 ? (
          <div className="zv-card p-10 text-center">
            <p className="text-sm text-neutral-400">No sales yet. This fills in as tickets sell.</p>
          </div>
        ) : (
          <div className="zv-card p-6">
            <div className="flex items-end gap-2 h-40">
              {days.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-2 group relative">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-yellow-500 to-yellow-300 min-h-[2px] transition-all"
                    style={{ height: `${(d.revenue / maxDayRevenue) * 100}%` }}
                    title={`${d.label}: ${d.revenue.toLocaleString()} ${currency}`}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              {days.map((d, i) => (
                <div key={d.date} className="flex-1 text-center overflow-hidden">
                  {i % 4 === 0 && <p className="text-[10px] text-neutral-400 whitespace-nowrap">{d.label}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="font-semibold text-neutral-900 mb-3">Revenue by ticket type</h2>
        {typeBreakdown.length === 0 ? (
          <div className="zv-card p-10 text-center">
            <p className="text-sm text-neutral-400">No sales yet.</p>
          </div>
        ) : (
          <div className="zv-card p-6 space-y-4">
            {typeBreakdown.map((t) => (
              <div key={t.name}>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm mb-1.5">
                  <span className="font-medium text-neutral-800">
                    {t.name} <span className="text-neutral-400 font-normal">· {t.quantity} sold</span>
                  </span>
                  <span className="text-neutral-600">
                    {t.revenue.toLocaleString()} {currency}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600"
                    style={{ width: `${(t.revenue / maxTypeRevenue) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-semibold text-neutral-900 mb-3">Revenue by event</h2>
        {eventBreakdown.length === 0 ? (
          <div className="zv-card p-10 text-center">
            <p className="text-sm text-neutral-400">No sales yet.</p>
          </div>
        ) : (
          <div className="zv-card p-6 space-y-4">
            {eventBreakdown.map((e) => (
              <div key={e.eventId}>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm mb-1.5">
                  <span className="font-medium text-neutral-800">{e.title}</span>
                  <span className="text-neutral-600">
                    {e.revenue.toLocaleString()} {currency}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-yellow-600 to-yellow-400"
                    style={{ width: `${(e.revenue / maxEventRevenue) * 100}%` }}
                  />
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
    <div className="zv-card p-5">
      <p className="text-sm text-neutral-400">{label}</p>
      <p className={`text-2xl font-bold mt-1.5 ${accent ? "zv-gradient-text" : "text-neutral-900"}`}>{value}</p>
    </div>
  );
}
