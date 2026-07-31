import { createClient } from "@/lib/supabase/server";
import type { BankAccount, Organizer, Payout } from "@/lib/types";
import RunPayoutButton from "./run-payout-button";
import MarkPaidForm from "./mark-paid-form";
import PayViaPaystackButton from "./pay-via-paystack-button";

export default async function AdminPayoutsPage() {
  const supabase = await createClient();

  const { data: organizers } = await supabase.from("organizers").select("*").returns<Organizer[]>();
  const { data: payoutItems } = await supabase.from("payout_items").select("order_id");
  const excluded = new Set((payoutItems ?? []).map((p) => p.order_id));

  const preview = [];
  for (const organizer of organizers ?? []) {
    const { data: events } = await supabase.from("events").select("id").eq("organizer_id", organizer.id);
    const eventIds = (events ?? []).map((e) => e.id);
    if (!eventIds.length) continue;

    const { data: orders } = eventIds.length
      ? await supabase.from("orders").select("id, base_amount").in("event_id", eventIds).eq("status", "paid")
      : { data: [] };

    const unpaid = (orders ?? []).filter((o) => !excluded.has(o.id));
    if (!unpaid.length) continue;

    const grossSales = unpaid.reduce((s, o) => s + o.base_amount, 0);
    const feeRate = organizer.is_platform_own ? 0 : organizer.commission_rate;
    const platformFee = Math.round(grossSales * feeRate * 100) / 100;
    const netPayable = Math.round((grossSales - platformFee) * 100) / 100;

    preview.push({ organizer, grossSales, platformFee, netPayable });
  }

  const { data: payouts } = await supabase
    .from("payouts")
    .select("*, organizers(business_name, country, bank_account), events(title)")
    .order("created_at", { ascending: false })
    .returns<
      (Payout & {
        organizers: { business_name: string; country: string; bank_account: BankAccount | null };
        events: { title: string } | null;
      })[]
    >();

  const totalNetPending = preview.reduce((s, p) => s + p.netPayable, 0);

  return (
    <div className="max-w-4xl space-y-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-50">Payouts</h1>
        <p className="text-sm text-neutral-400 mt-1 max-w-2xl">
          Most payouts appear here on their own — a day after each event ends, its sales are totaled and a
          payout record is created automatically. Use the button below for anything that isn&apos;t covered
          yet (e.g. running events, or catching up sales missed for another reason). Either way, the actual
          bank transfer or wire still happens outside this app; use the reference field to log it.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-neutral-50">Pending this run</h2>
          <RunPayoutButton disabled={preview.length === 0} />
        </div>

        {preview.length === 0 ? (
          <div className="zv-card p-10 text-center">
            <p className="text-sm text-neutral-500">
              Nothing pending. All paid sales have been included in a payout.
            </p>
          </div>
        ) : (
          <div className="zv-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.04] text-left text-neutral-500">
                  <tr>
                    <th className="px-5 py-3 font-medium whitespace-nowrap">Organizer</th>
                    <th className="px-5 py-3 font-medium whitespace-nowrap">Gross sales</th>
                    <th className="px-5 py-3 font-medium whitespace-nowrap">Platform fee</th>
                    <th className="px-5 py-3 font-medium whitespace-nowrap">Net payable</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((p) => (
                    <tr key={p.organizer.id} className="border-t border-white/10">
                      <td className="px-5 py-3 font-medium text-neutral-100 whitespace-nowrap">
                        {p.organizer.business_name}
                        <span className="text-neutral-500 font-normal"> · {p.organizer.country}</span>
                      </td>
                      <td className="px-5 py-3 text-neutral-300 whitespace-nowrap">
                        {p.grossSales.toLocaleString()} {p.organizer.payout_currency}
                      </td>
                      <td className="px-5 py-3 text-neutral-300 whitespace-nowrap">
                        {p.organizer.is_platform_own
                          ? "0 (own event)"
                          : `${p.platformFee.toLocaleString()} ${p.organizer.payout_currency}`}
                      </td>
                      <td className="px-5 py-3 font-semibold zv-gradient-text whitespace-nowrap">
                        {p.netPayable.toLocaleString()} {p.organizer.payout_currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/15 font-semibold">
                    <td className="px-5 py-3 text-neutral-200 whitespace-nowrap" colSpan={3}>
                      Total across organizers (mixed currencies)
                    </td>
                    <td className="px-5 py-3 text-neutral-50 whitespace-nowrap">{totalNetPending.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="font-semibold text-neutral-50">Payout history</h2>
        {(!payouts || payouts.length === 0) ? (
          <div className="zv-card p-10 text-center">
            <p className="text-sm text-neutral-500">No payouts run yet.</p>
          </div>
        ) : (
          <div className="zv-card divide-y divide-white/10 overflow-hidden">
            {payouts?.map((p) => (
              <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-5 py-3.5 text-sm">
                <div>
                  <p className="font-medium text-neutral-100">
                    {p.organizers.business_name}{" "}
                    <span className="text-neutral-500 font-normal">· {p.organizers.country}</span>
                    {p.events?.title && (
                      <span className="zv-badge bg-white/[0.08] text-neutral-300 ml-2 align-middle">
                        {p.events.title}
                      </span>
                    )}
                  </p>
                  <p className="text-neutral-500">
                    {p.net_payable.toLocaleString()} {p.currency} · {new Date(p.created_at).toLocaleDateString()}
                    {p.processor_fee_estimate != null && (
                      <>
                        {" "}
                        · your real margin ≈{" "}
                        {(p.platform_fee - p.processor_fee_estimate).toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}{" "}
                        {p.currency} after processor fees
                      </>
                    )}
                  </p>
                </div>
                {p.status === "paid" ? (
                  <span className="zv-badge bg-emerald-500/15 text-emerald-300">
                    Paid {p.reference ? `· ${p.reference}` : ""}
                  </span>
                ) : p.status === "processing" ? (
                  <span className="zv-badge bg-amber-500/15 text-amber-300">
                    Processing {p.reference ? `· ${p.reference}` : ""}
                  </span>
                ) : p.organizers.country === "NG" &&
                  p.organizers.bank_account?.account_number &&
                  p.organizers.bank_account?.bank_code ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <PayViaPaystackButton payoutId={p.id} />
                    <MarkPaidForm payoutId={p.id} />
                  </div>
                ) : (
                  <MarkPaidForm payoutId={p.id} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
