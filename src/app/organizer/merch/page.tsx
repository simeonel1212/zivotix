import { getCurrentOrganizer } from "@/lib/organizer";
import NoOrganizerNotice from "@/components/no-organizer-notice";
import { formatMoney } from "@/lib/currencies";
import type { MerchProduct, MerchOrder } from "@/lib/types";
import ProductForm from "./product-form";
import ProductRow from "./product-row";
import FulfilButton from "./fulfil-button";

export default async function OrganizerMerchPage() {
  const { supabase, organizer } = await getCurrentOrganizer("/organizer/merch");
  if (!organizer) return <NoOrganizerNotice title="Merch" />;

  const { data: products } = await supabase
    .from("merch_products")
    .select("*")
    .eq("organizer_id", organizer.id)
    .order("created_at", { ascending: false })
    .returns<MerchProduct[]>();

  const { data: orders } = await supabase
    .from("merch_orders")
    .select("*")
    .eq("organizer_id", organizer.id)
    .eq("status", "paid")
    .order("created_at", { ascending: false })
    .returns<MerchOrder[]>();

  const paid = orders ?? [];
  const soldByProduct = new Map<string, number>();
  for (const o of paid) {
    soldByProduct.set(o.product_id, (soldByProduct.get(o.product_id) ?? 0) + o.quantity);
  }

  const revenue = paid.reduce((s, o) => s + o.base_amount, 0);
  // Split because they need different actions: a parcel needs posting, a
  // pickup needs someone at a door with a scanner.
  const toPost = paid.filter((o) => o.fulfilment === "ship" && !o.fulfilled_at);
  const toCollect = paid.filter((o) => o.fulfilment === "pickup" && !o.fulfilled_at);

  const productName = new Map((products ?? []).map((p) => [p.id, p.name]));

  // Payouts go out the next day, so by the time a buyer complains that nothing
  // arrived, the organizer already has the money. Nothing here can undo that —
  // but an order visibly sitting unposted for nine days is the difference
  // between finding out now and finding out from an angry email.
  const daysWaiting = (iso: string) =>
    Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="zv-h1 text-neutral-50">Merch</h1>
          <p className="text-sm text-neutral-400 mt-2">
            Sell shirts, caps and prints to the people already coming to your events. Collected at
            the door or posted out — your choice per item.
          </p>
        </div>
        <ProductForm organizerId={organizer.id} defaultCurrency={organizer.payout_currency} />
      </div>

      {paid.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Orders" value={String(paid.length)} />
          <Stat label="To post" value={String(toPost.length)} />
          <Stat label="To collect" value={String(toCollect.length)} />
          <Stat label="Revenue" value={formatMoney(revenue, paid[0]?.base_currency ?? "NGN")} />
        </div>
      )}

      <section>
        <h2 className="font-semibold text-neutral-50 mb-3">Items</h2>
        {!products?.length ? (
          <div className="zv-card p-10 text-center">
            <p className="text-sm text-neutral-500">
              Nothing yet. Add an item and it appears under Merch on your public page.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {products.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                organizerId={organizer.id}
                soldCount={soldByProduct.get(p.id) ?? 0}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Parcels first: it's the list with a deadline attached. Pickups sort
          themselves out at the door. */}
      {toPost.length > 0 && (
        <section>
          <h2 className="font-semibold text-neutral-50 mb-3">
            To post <span className="text-neutral-500 font-normal">({toPost.length})</span>
          </h2>
          <div className="zv-card divide-y divide-white/10 overflow-hidden">
            {toPost.map((o) => (
              <div key={o.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-50">
                      {o.quantity} × {productName.get(o.product_id) ?? "Item"}
                      {o.size ? ` · ${o.size}` : ""}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {o.buyer_name} · {o.buyer_email}
                    </p>
                    {(() => {
                      const d = daysWaiting(o.created_at);
                      if (d < 2) return null;
                      return (
                        <p
                          className={`text-xs mt-1 font-semibold ${
                            d >= 7 ? "text-red-400" : "text-amber-400"
                          }`}
                        >
                          Waiting {d} days
                        </p>
                      );
                    })()}
                  </div>
                  <FulfilButton orderId={o.id} label="Mark posted" />
                </div>
                <p className="text-sm text-neutral-300 whitespace-pre-line rounded-2xl bg-white/[0.04] border border-white/10 px-3 py-2">
                  {o.shipping_address}
                  {o.shipping_phone && `\n${o.shipping_phone}`}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-semibold text-neutral-50 mb-3">
          To collect at the door{" "}
          <span className="text-neutral-500 font-normal">({toCollect.length})</span>
        </h2>
        {!toCollect.length ? (
          <div className="zv-card p-10 text-center">
            <p className="text-sm text-neutral-500">Nothing waiting to be collected.</p>
          </div>
        ) : (
          <div className="zv-card divide-y divide-white/10 overflow-hidden">
            {toCollect.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-50 truncate">
                    {o.quantity} × {productName.get(o.product_id) ?? "Item"}
                    {o.size ? ` · ${o.size}` : ""}
                  </p>
                  <p className="text-xs text-neutral-500 truncate">{o.buyer_name}</p>
                </div>
                <FulfilButton orderId={o.id} label="Handed over" />
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-neutral-500 mt-3">
          Buyers show a QR code. Scanning it in the door app marks it collected automatically — this
          list is the manual fallback.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="zv-card p-4">
      <p className="text-xl font-bold text-neutral-50 tabular-nums">{value}</p>
      <p className="text-xs text-neutral-400 mt-0.5">{label}</p>
    </div>
  );
}
