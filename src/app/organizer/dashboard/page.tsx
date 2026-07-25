import type { EventRow, Order } from "@/lib/types";
import { getCurrentOrganizer } from "@/lib/organizer";
import NoOrganizerNotice from "@/components/no-organizer-notice";

export default async function OrganizerDashboardPage() {
  const { supabase, organizer } = await getCurrentOrganizer("/organizer/dashboard");
  if (!organizer) return <NoOrganizerNotice title="Dashboard" />;

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("organizer_id", organizer.id)
    .returns<EventRow[]>();

  const eventIds = (events ?? []).map((e) => e.id);

  const { data: orders } = eventIds.length
    ? await supabase.from("orders").select("*").in("event_id", eventIds).eq("status", "paid").returns<Order[]>()
    : { data: [] as Order[] };

  const grossSales = (orders ?? []).reduce((sum, o) => sum + o.base_amount, 0);
  const upcoming = (events ?? []).filter((e) => new Date(e.starts_at) > new Date() && e.status === "published");
  const currency = organizer?.payout_currency ?? "NGN";

  return (
    <div className="space-y-10 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Dashboard</h1>
        <p className="text-sm text-neutral-500 mt-1">A quick look at how things are going.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Stat label="Gross sales (paid)" value={`${grossSales.toLocaleString()} ${currency}`} accent />
        <Stat label="Orders" value={String((orders ?? []).length)} />
        <Stat label="Upcoming events" value={String(upcoming.length)} />
      </div>

      <div>
        <h2 className="font-semibold text-neutral-900 mb-3">Recent orders</h2>
        {(orders ?? []).length === 0 ? (
          <div className="zv-card p-10 text-center">
            <p className="text-sm text-neutral-400">No paid orders yet.</p>
          </div>
        ) : (
          <div className="zv-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50/80 text-left text-neutral-400">
                  <tr>
                    <th className="px-5 py-3 font-medium whitespace-nowrap">Buyer</th>
                    <th className="px-5 py-3 font-medium whitespace-nowrap">Amount</th>
                    <th className="px-5 py-3 font-medium whitespace-nowrap">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(orders ?? [])
                    .slice()
                    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
                    .slice(0, 10)
                    .map((o) => (
                      <tr key={o.id} className="border-t border-neutral-100">
                        <td className="px-5 py-3 font-medium text-neutral-800 whitespace-nowrap">{o.buyer_name}</td>
                        <td className="px-5 py-3 text-neutral-600 whitespace-nowrap">
                          {o.base_amount.toLocaleString()} {o.base_currency}
                        </td>
                        <td className="px-5 py-3 text-neutral-400 whitespace-nowrap">
                          {new Date(o.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
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
