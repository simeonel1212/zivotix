"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { WORLD_CURRENCIES, currencyLabel } from "@/lib/currencies";
import { computeFees } from "@/lib/fees";
import { formatMoney } from "@/lib/currencies";
import CoverImageUpload from "@/components/cover-image-upload";
import type { MerchProduct, Fulfilment } from "@/lib/types";

const MAX_PHOTOS = 3;

// Creates or edits one merch product.
//
// Three photos maximum, matching the database constraint. It's a deliberate
// cap rather than a soft limit: an organizer selling a t-shirt needs front,
// back and worn, and past that a product page becomes a scroll.
export default function ProductForm({
  organizerId,
  defaultCurrency,
  product,
  soldCount = 0,
  onDone,
}: {
  organizerId: string;
  defaultCurrency: string;
  product?: MerchProduct;
  /** How many have sold. Gates deletion. */
  soldCount?: number;
  onDone?: () => void;
}) {
  const editing = Boolean(product);
  const router = useRouter();
  const [open, setOpen] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [photos, setPhotos] = useState<string[]>(product?.image_urls ?? []);
  const [form, setForm] = useState({
    name: product?.name ?? "",
    description: product?.description ?? "",
    price: product ? String(product.price) : "",
    currency: product?.currency ?? defaultCurrency,
    sizes: (product?.sizes ?? []).join(", "),
    stock: product?.stock === null || product?.stock === undefined ? "" : String(product.stock),
    fulfilment: (product?.fulfilment ?? "pickup") as Fulfilment,
    shippingFee: product?.shipping_fee != null ? String(product.shipping_fee) : "",
  });

  const price = Number(form.price);
  const canShip = form.fulfilment !== "pickup";
  const fees = price > 0 ? computeFees(price, form.currency, "pass") : null;

  function close() {
    setOpen(false);
    setError(null);
    onDone?.();
  }

  async function save() {
    setError(null);
    if (!form.name.trim()) return setError("Give it a name.");
    if (!(price >= 0) || !form.price.trim()) return setError("Set a price.");
    if (!photos.length) return setError("Add at least one photo — nobody buys a blank square.");
    if (canShip && !form.shippingFee.trim())
      return setError("Set a delivery fee. Enter 0 if delivery is free.");

    const values = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price,
      currency: form.currency,
      image_urls: photos.slice(0, MAX_PHOTOS),
      // "S, M, L" from one text field rather than a repeater: sizes differ
      // wildly by product and a list of inputs is more UI than the data needs.
      sizes: form.sizes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      stock: form.stock.trim() === "" ? null : Math.max(0, Number(form.stock)),
      fulfilment: form.fulfilment,
      shipping_fee: canShip ? Number(form.shippingFee) : null,
    };

    setSaving(true);
    const supabase = createClient();
    const { error: writeError } = product
      ? await supabase.from("merch_products").update(values).eq("id", product.id)
      : await supabase.from("merch_products").insert({ organizer_id: organizerId, ...values });
    setSaving(false);
    if (writeError) return setError(writeError.message);

    if (!product) {
      setForm({ ...form, name: "", description: "", price: "", stock: "" });
      setPhotos([]);
    }
    close();
    router.refresh();
  }

  async function remove() {
    setSaving(true);
    const { error: deleteError } = await createClient()
      .from("merch_products")
      .delete()
      .eq("id", product!.id);
    setSaving(false);
    if (deleteError) return setError(deleteError.message);
    close();
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="zv-btn-primary text-sm">
        + New item
      </button>
    );
  }

  return (
    <div className="zv-card p-6 space-y-5">
      <h2 className="font-semibold text-neutral-50">{editing ? "Edit item" : "New item"}</h2>

      {editing && soldCount > 0 && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 px-4 py-3 text-sm text-amber-200">
          {soldCount} sold already. Changes here apply to new orders only — what people already
          bought and paid for doesn&apos;t change.
        </div>
      )}

      {/* Photos first: it's the thing that sells the item, and burying it under
          a form makes organizers treat it as optional. */}
      <div>
        <label className="zv-label">Photos (up to {MAX_PHOTOS})</label>
        <div className="grid grid-cols-3 gap-2 mt-1.5">
          {Array.from({ length: MAX_PHOTOS }, (_, i) => (
            <CoverImageUpload
              key={i}
              value={photos[i] ?? ""}
              onChange={(url) =>
                setPhotos((prev) => {
                  const next = [...prev];
                  if (url) next[i] = url;
                  else next.splice(i, 1);
                  return next.filter(Boolean).slice(0, MAX_PHOTOS);
                })
              }
            />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="zv-label">Name</label>
          <input
            className="zv-input"
            placeholder="Tour tee"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>

        <div>
          <label className="zv-label">Description (optional)</label>
          <textarea
            className="zv-input min-h-[72px] resize-y leading-relaxed"
            placeholder={"Heavyweight cotton, boxy fit.\nPress Enter for a new line"}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="zv-label">Price</label>
            <input
              type="number"
              className="zv-input"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            />
          </div>
          <div>
            <label className="zv-label">Currency</label>
            <select
              className="zv-input"
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
            >
              {WORLD_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {currencyLabel(c)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="zv-label">Sizes (optional)</label>
            <input
              className="zv-input"
              placeholder="S, M, L, XL"
              value={form.sizes}
              onChange={(e) => setForm((f) => ({ ...f, sizes: e.target.value }))}
            />
          </div>
          <div>
            <label className="zv-label">Stock</label>
            <input
              type="number"
              className="zv-input"
              placeholder="Leave blank = unlimited"
              value={form.stock}
              onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
            />
          </div>
        </div>
      </div>

      <div>
        <label className="zv-label">How buyers get it</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1.5">
          {(
            [
              { k: "pickup" as const, t: "Collect at event", d: "Scanned at the door." },
              { k: "ship" as const, t: "Delivery only", d: "You post it out." },
              { k: "both" as const, t: "Buyer chooses", d: "Either, their call." },
            ]
          ).map((opt) => (
            <button
              key={opt.k}
              type="button"
              onClick={() => setForm((f) => ({ ...f, fulfilment: opt.k }))}
              aria-pressed={form.fulfilment === opt.k}
              className={`rounded-2xl border p-3.5 text-left transition-colors ${
                form.fulfilment === opt.k
                  ? "border-yellow-400/60 bg-yellow-500/10"
                  : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
              }`}
            >
              <p className="text-sm font-semibold text-neutral-50">{opt.t}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{opt.d}</p>
            </button>
          ))}
        </div>
      </div>

      {canShip && (
        <div>
          <label className="zv-label">Delivery fee ({form.currency})</label>
          <input
            type="number"
            className="zv-input"
            placeholder="0 for free delivery"
            value={form.shippingFee}
            onChange={(e) => setForm((f) => ({ ...f, shippingFee: e.target.value }))}
          />
          <p className="text-xs text-neutral-500 mt-1">
            Charged once per order, not per item — two shirts go in one parcel.
          </p>
        </div>
      )}

      {fees && (
        <div className="rounded-2xl bg-white/[0.04] border border-white/10 px-4 py-3 text-sm text-neutral-300 space-y-1">
          <p>
            Buyers pay{" "}
            <strong className="text-neutral-50">{formatMoney(fees.total, form.currency)}</strong> per
            item.
          </p>
          <p className="text-neutral-400">
            You receive {formatMoney(fees.organizerReceives, form.currency)}.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={saving} className="zv-btn-primary text-sm">
          {saving ? "Saving…" : editing ? "Save changes" : "Add item"}
        </button>
        <button onClick={close} className="text-sm text-neutral-500 hover:text-neutral-300">
          Cancel
        </button>

        {/* Deleting is only offered before anything sells. After that the row
            has to stay for the buyer's order to still make sense. */}
        {editing && soldCount === 0 && (
          <div className="ml-auto">
            {confirmingDelete ? (
              <span className="flex items-center gap-2 text-sm">
                <span className="text-neutral-400">Delete?</span>
                <button onClick={remove} disabled={saving} className="font-semibold text-red-400">
                  Yes
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="text-neutral-500 hover:text-neutral-300"
                >
                  No
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="text-sm text-neutral-500 hover:text-red-400"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
