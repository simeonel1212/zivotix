import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  assessMerch,
  merchSubtotal,
  fulfilmentAllows,
  isMerchReference,
  MERCH_REFERENCE_PREFIX,
} from "../merch.ts";

const tee = {
  is_active: true,
  stock: 10 as number | null,
  sizes: ["S", "M", "L"],
  fulfilment: "both" as const,
};

describe("assessMerch", () => {
  test("a valid pick is buyable", () => {
    const r = assessMerch(tee, { quantity: 2, size: "M", fulfilment: "ship" });
    assert.equal(r.buyable, true);
    assert.equal(r.stockLeft, 10);
  });

  test("refuses more than the stock on hand", () => {
    const r = assessMerch(tee, { quantity: 11, size: "M" });
    assert.equal(r.buyable, false);
    assert.equal(r.reason, "not_enough_stock");
  });

  test("zero stock is sold out, not merely short", () => {
    const r = assessMerch({ ...tee, stock: 0 }, { quantity: 1, size: "M" });
    assert.equal(r.reason, "sold_out");
  });

  test("null stock means unlimited", () => {
    const r = assessMerch({ ...tee, stock: null }, { quantity: 20, size: "L" });
    assert.equal(r.buyable, true);
    assert.equal(r.stockLeft, null);
  });

  test("a product with sizes demands one, and only a real one", () => {
    assert.equal(assessMerch(tee, { quantity: 1 }).reason, "size_required");
    assert.equal(assessMerch(tee, { quantity: 1, size: "XXL" }).reason, "size_required");
  });

  test("a product without sizes needs none", () => {
    const cap = { ...tee, sizes: [] };
    assert.equal(assessMerch(cap, { quantity: 1 }).buyable, true);
  });

  test("an inactive product is refused before anything else", () => {
    const r = assessMerch({ ...tee, is_active: false }, { quantity: 1, size: "M" });
    assert.equal(r.reason, "inactive");
  });

  test("a pickup-only product can't be shipped", () => {
    const r = assessMerch({ ...tee, fulfilment: "pickup" }, {
      quantity: 1,
      size: "M",
      fulfilment: "ship",
    });
    assert.equal(r.buyable, false);
    assert.equal(r.reason, "bad_fulfilment");
  });
});

describe("fulfilmentAllows", () => {
  test("both permits either, the others only themselves", () => {
    assert.equal(fulfilmentAllows("both", "ship"), true);
    assert.equal(fulfilmentAllows("both", "pickup"), true);
    assert.equal(fulfilmentAllows("pickup", "pickup"), true);
    assert.equal(fulfilmentAllows("pickup", "ship"), false);
    assert.equal(fulfilmentAllows("ship", "pickup"), false);
  });
});

describe("merchSubtotal", () => {
  const product = { price: 15000, shipping_fee: 2500 };

  test("shipping is charged once per order, not per item", () => {
    // Two shirts go in one parcel; charging postage twice is the kind of thing
    // buyers notice.
    const r = merchSubtotal(product, 3, "ship");
    assert.equal(r.goods, 45000);
    assert.equal(r.shipping, 2500);
    assert.equal(r.subtotal, 47500);
  });

  test("pickup carries no shipping", () => {
    const r = merchSubtotal(product, 2, "pickup");
    assert.equal(r.shipping, 0);
    assert.equal(r.subtotal, 30000);
  });

  test("a missing shipping fee counts as zero rather than NaN", () => {
    const r = merchSubtotal({ price: 5000, shipping_fee: null }, 1, "ship");
    assert.equal(r.subtotal, 5000);
  });
});

describe("merch references", () => {
  test("are distinguishable from ticket and membership ones", () => {
    assert.equal(isMerchReference(`${MERCH_REFERENCE_PREFIX}_abc`), true);
    assert.equal(isMerchReference("zvx_abc"), false);
    assert.equal(isMerchReference("zvxm_abc"), false);
    assert.equal(isMerchReference(null), false);
  });
});
