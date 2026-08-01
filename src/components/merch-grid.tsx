"use client";

import { useState } from "react";
import Image from "next/image";
import { computeFees } from "@/lib/fees";
import { formatMoney } from "@/lib/currencies";
import ChargePreview from "@/components/charge-preview";
import { assessMerch, merchRefusalMessage, merchSubtotal } from "@/lib/merch";
import type { MerchProduct } from "@/lib/types";

// An organizer's merch, on their profile.
//
// Deliberately a light-touch shop: pick a size, pick how you want it, pay. No
// cart spanning multiple products, because an organizer with four items is not
// running a store — they're selling a shirt to people who already came to the
// party, and a cart would add a step to a two-item purchase.
export default function MerchGrid({
  products,
  chargeCurrencies = {},
}: {
  products: MerchProduct[];
  /** Product currency → what the card is billed in, decided server-side. */
  chargeCurrencies?: Record<string, string>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (!products.length) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {products.map((p) => (
        <MerchCard
          key={p.id}
          product={p}
          chargeCurrency={chargeCurrencies[p.currency] ?? p.currency}
          open={openId === p.id}
          onOpen={() => setOpenId(p.id)}
          onClose={() => setOpenId(null)}
        />
      ))}
    </div>
  );
}

function MerchCard({
  product,
  chargeCurrency,
  open,
  onOpen,
  onClose,
}: {
  product: MerchProduct;
  chargeCurrency: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const [photo, setPhoto] = useState(0);
  const [size, setSize] = useState<string | null>(product.sizes[0] ?? null);
  const [quantity, setQuantity] = useState(1);
  const [fulfilment, setFulfilment] = useState<"pickup" | "ship">(
    product.fulfilment === "ship" ? "ship" : "pickup"
  );
  const [buyer, setBuyer] = useState({ name: "", email: "", address: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const state = assessMerch(product, { quantity, size, fulfilment });
  const { goods, shipping, subtotal } = merchSubtotal(product, quantity, fulfilment);
  const fees = computeFees(subtotal, product.currency, "pass");
  const canChooseFulfilment = product.fulfilment === "both";

  async function buy() {
    setError(null);
    if (!buyer.name.trim() || !buyer.email.trim()) return setError("Enter your name and email.");
    if (fulfilment === "ship" && !buyer.address.trim())
      return setError("Enter where we should send it.");

    setLoading(true);
    try {
      const res = await fetch("/api/merch/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          buyerName: buyer.name,
          buyerEmail: buyer.email,
          quantity,
          size,
          fulfilment,
          shippingAddress: fulfilment === "ship" ? buyer.address : null,
          shippingPhone: fulfilment === "ship" ? buyer.phone : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start that purchase");
      window.location.assign(data.redirectUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="zv-card overflow-hidden flex flex-col">
      <div className="relative aspect-square bg-white/[0.04]">
        {product.image_urls[photo] ? (
          <Image
            src={product.image_urls[photo]}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, 320px"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-bold zv-gradient-text opacity-40">
              {product.name.slice(0, 1)}
            </span>
          </div>
        )}

        {/* Dots rather than arrows: with a maximum of three photos, arrows are
            more chrome than the gallery is worth. */}
        {product.image_urls.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {product.image_urls.map((url, i) => (
              <button
                key={url}
                onClick={() => setPhoto(i)}
                aria-label={`Photo ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === photo ? "w-5 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        )}

        {state.stockLeft !== null && state.stockLeft > 0 && state.stockLeft <= 5 && (
          <span className="absolute top-3 left-3 zv-badge bg-amber-500/20 text-amber-200 backdrop-blur-sm">
            {state.stockLeft} left
          </span>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1">
        <p className="font-semibold text-neutral-50">{product.name}</p>
        {product.description && (
          <p className="mt-1.5 text-sm text-neutral-400 leading-relaxed whitespace-pre-line line-clamp-3">
            {product.description}
          </p>
        )}
        <p className="mt-3 text-xl font-bold zv-gradient-text">
          {formatMoney(product.price, product.currency)}
        </p>

        {!open ? (
          <button
            onClick={onOpen}
            disabled={!assessMerch(product, { quantity: 1, size: product.sizes[0] ?? null }).buyable}
            className="zv-btn-secondary text-sm mt-4 w-full disabled:opacity-40"
          >
            {product.stock === 0 ? "Sold out" : "Buy"}
          </button>
        ) : (
          <div className="mt-4 space-y-3">
            {product.sizes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    className={`zv-badge transition-colors ${
                      size === s
                        ? "bg-white text-neutral-900"
                        : "bg-white/[0.08] text-neutral-300 hover:bg-white/[0.14]"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {canChooseFulfilment && (
              <div className="flex gap-2">
                {(["pickup", "ship"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFulfilment(f)}
                    className={`zv-badge transition-colors ${
                      fulfilment === f
                        ? "bg-white text-neutral-900"
                        : "bg-white/[0.08] text-neutral-300 hover:bg-white/[0.14]"
                    }`}
                  >
                    {f === "pickup"
                      ? "Collect at event"
                      : `Deliver${product.shipping_fee ? ` +${formatMoney(product.shipping_fee, product.currency)}` : ""}`}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <select
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="zv-input w-20 text-center text-sm"
              >
                {Array.from({ length: Math.min(20, state.stockLeft ?? 20) }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <p className="text-sm text-neutral-400">
                {formatMoney(goods, product.currency)}
                {shipping > 0 && ` + ${formatMoney(shipping, product.currency)} delivery`}
              </p>
            </div>

            <input
              placeholder="Full name"
              className="zv-input text-sm"
              value={buyer.name}
              onChange={(e) => setBuyer((b) => ({ ...b, name: e.target.value }))}
            />
            <input
              placeholder="Email"
              type="email"
              className="zv-input text-sm"
              value={buyer.email}
              onChange={(e) => setBuyer((b) => ({ ...b, email: e.target.value }))}
            />

            {fulfilment === "ship" && (
              <>
                <textarea
                  placeholder="Delivery address"
                  className="zv-input text-sm min-h-[64px] resize-y"
                  value={buyer.address}
                  onChange={(e) => setBuyer((b) => ({ ...b, address: e.target.value }))}
                />
                <input
                  placeholder="Phone (for the courier)"
                  className="zv-input text-sm"
                  value={buyer.phone}
                  onChange={(e) => setBuyer((b) => ({ ...b, phone: e.target.value }))}
                />
              </>
            )}

            <div className="rounded-2xl bg-white/[0.04] border border-white/10 px-4 py-3 text-sm">
              <div className="flex justify-between text-neutral-400">
                <span>Service fee</span>
                <span>{formatMoney(fees.serviceFee, product.currency)}</span>
              </div>
              <div className="flex justify-between font-bold text-neutral-50 mt-1">
                <span>Total</span>
                <span>{formatMoney(fees.total, product.currency)}</span>
              </div>
              <ChargePreview
                amount={fees.total}
                from={product.currency}
                to={chargeCurrency}
                className="block text-right text-xs text-neutral-500 mt-1"
              />
            </div>

            {!state.buyable && (
              <p className="text-xs text-amber-400">{merchRefusalMessage(state.reason)}</p>
            )}
            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex items-center gap-2">
              <button
                onClick={buy}
                disabled={loading || !state.buyable}
                className="zv-btn-primary text-sm w-full sm:w-auto disabled:opacity-40"
              >
                {loading ? "Taking you to pay…" : "Buy now"}
              </button>
              <button onClick={onClose} className="text-sm text-neutral-500 hover:text-neutral-300">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
