"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/currencies";
import type { MerchProduct } from "@/lib/types";
import ProductForm from "./product-form";

const FULFILMENT_LABEL = {
  pickup: "Collect at event",
  ship: "Delivery",
  both: "Collect or delivery",
} as const;

export default function ProductRow({
  product,
  organizerId,
  soldCount,
}: {
  product: MerchProduct;
  organizerId: string;
  soldCount: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleActive() {
    setBusy(true);
    await createClient()
      .from("merch_products")
      .update({ is_active: !product.is_active })
      .eq("id", product.id);
    setBusy(false);
    router.refresh();
  }

  if (editing) {
    return (
      <li>
        <ProductForm
          organizerId={organizerId}
          defaultCurrency={product.currency}
          product={product}
          soldCount={soldCount}
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="zv-card p-4 flex gap-4">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-white/[0.04]">
        {product.image_urls[0] && (
          <Image src={product.image_urls[0]} alt="" fill sizes="80px" className="object-cover" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="font-semibold text-neutral-50 truncate">{product.name}</p>
          <p className="font-semibold text-neutral-50 whitespace-nowrap">
            {formatMoney(product.price, product.currency)}
          </p>
        </div>

        <p className="text-xs text-neutral-500 mt-1">
          {FULFILMENT_LABEL[product.fulfilment]}
          {product.sizes.length > 0 && ` · ${product.sizes.join("/")}`}
          {product.stock === null ? " · unlimited" : ` · ${product.stock} left`}
          {soldCount > 0 && ` · ${soldCount} sold`}
          {!product.is_active && " · not on sale"}
        </p>

        <div className="flex items-center gap-4 mt-3">
          <button onClick={() => setEditing(true)} className="text-sm font-semibold zv-gradient-text">
            Edit
          </button>
          <button
            onClick={toggleActive}
            disabled={busy}
            className="text-sm text-neutral-500 hover:text-neutral-200 disabled:opacity-40"
          >
            {busy ? "Saving…" : product.is_active ? "Take off sale" : "Put back on sale"}
          </button>
        </div>
      </div>
    </li>
  );
}
