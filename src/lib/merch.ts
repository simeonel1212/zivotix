import type { MerchProduct, Fulfilment } from "@/lib/types";

// Rules a merch purchase is judged by, in one place so the product page, the
// checkout route and the organizer's dashboard can't disagree about what's on
// sale or what it costs.

/**
 * Merch references carry their own prefix, the same trick tickets and
 * memberships use: the payment-return page can tell what it's confirming from
 * the reference alone, before touching the database.
 */
export const MERCH_REFERENCE_PREFIX = "zvxs";

export function isMerchReference(reference: string | null | undefined): boolean {
  return !!reference && reference.startsWith(MERCH_REFERENCE_PREFIX);
}

export type MerchRefusal = "inactive" | "sold_out" | "not_enough_stock" | "size_required" | "bad_fulfilment";

export interface MerchAvailability {
  buyable: boolean;
  /** How many are left, or null when stock isn't tracked. */
  stockLeft: number | null;
  reason?: MerchRefusal;
}

/**
 * Whether this product can be bought right now, in this quantity, with this
 * size and delivery choice.
 *
 * Checked here and again server-side at checkout. The copy in between is not
 * duplication for its own sake — the page needs the answer to grey out a
 * button, and the route needs it because a page's answer can be minutes stale
 * and is trivially bypassed.
 */
export function assessMerch(
  product: Pick<MerchProduct, "is_active" | "stock" | "sizes" | "fulfilment">,
  opts: { quantity?: number; size?: string | null; fulfilment?: "pickup" | "ship" } = {}
): MerchAvailability {
  const quantity = opts.quantity ?? 1;
  const stockLeft = product.stock;

  if (!product.is_active) return { buyable: false, stockLeft, reason: "inactive" };
  if (stockLeft !== null && stockLeft <= 0) return { buyable: false, stockLeft: 0, reason: "sold_out" };
  if (stockLeft !== null && quantity > stockLeft) {
    return { buyable: false, stockLeft, reason: "not_enough_stock" };
  }
  // An empty sizes array means there's nothing to pick, so no size is correct.
  // A non-empty one means a choice must be made and must be one of the offered
  // values — otherwise an organizer packs the wrong box.
  if (product.sizes.length > 0 && !(opts.size && product.sizes.includes(opts.size))) {
    return { buyable: false, stockLeft, reason: "size_required" };
  }
  if (opts.fulfilment && !fulfilmentAllows(product.fulfilment, opts.fulfilment)) {
    return { buyable: false, stockLeft, reason: "bad_fulfilment" };
  }
  return { buyable: true, stockLeft };
}

export function fulfilmentAllows(allowed: Fulfilment, chosen: "pickup" | "ship"): boolean {
  return allowed === "both" || allowed === chosen;
}

/** What the buyer is told, in words that say what to do next. */
export function merchRefusalMessage(reason: MerchRefusal | undefined): string {
  switch (reason) {
    case "sold_out":
      return "Sold out";
    case "not_enough_stock":
      return "Not that many left";
    case "size_required":
      return "Pick a size";
    case "inactive":
      return "Not on sale";
    case "bad_fulfilment":
      return "That delivery option isn't available for this item";
    default:
      return "Not available";
  }
}

/**
 * What a merch order costs, before the platform's service fee.
 *
 * Shipping is charged once per order rather than per item — posting two
 * t-shirts in one parcel costs the organizer one postage, and charging twice
 * for it is the kind of thing buyers notice and resent.
 */
export function merchSubtotal(
  product: Pick<MerchProduct, "price" | "shipping_fee">,
  quantity: number,
  fulfilment: "pickup" | "ship"
): { goods: number; shipping: number; subtotal: number } {
  const goods = product.price * quantity;
  const shipping = fulfilment === "ship" ? (product.shipping_fee ?? 0) : 0;
  return { goods, shipping, subtotal: goods + shipping };
}
