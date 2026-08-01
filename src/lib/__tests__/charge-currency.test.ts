import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { resolveChargeCurrency } from "../fx.ts";
import { estimateProcessorFee } from "../processor-fees.ts";
import { WORLD_CURRENCIES } from "../currencies.ts";

// Regression cover for a live outage: a Thai buyer's ฿535 was converted to
// $15.96 and Paystack refused it outright with "Currency not supported by
// merchant" — the account has only NGN enabled, so the card was never even
// contacted. Three published Thai events could take no money at all.

describe("charge currency after the USD outage", () => {
  test("nothing is ever charged in a currency this merchant can't take", () => {
    // The single assertion that would have caught the outage. USD is not
    // enabled on the Paystack account; returning it guarantees a failure
    // before the buyer's card is reached.
    for (const currency of WORLD_CURRENCIES) {
      assert.equal(
        resolveChargeCurrency(currency),
        "NGN",
        `${currency} must settle in NGN while USD is disabled on the account`
      );
    }
  });
});

describe("processor fee once everything settles in NGN", () => {
  test("a Nigerian sale is still costed at the local rate", () => {
    // 10,000 × 1.5% + 100 flat = 250, then 7.5% VAT = 268.75.
    assert.equal(estimateProcessorFee("paystack", 10_000, "NGN", "NGN"), 268.75);
  });

  test("a foreign card is costed at the international rate despite paying NGN", () => {
    // The whole point of threading the event currency through. Paystack bills
    // 3.9% on a foreign-issued card whatever currency it was charged in, so
    // costing a Thai sale as local would overstate the margin on every one.
    const foreign = estimateProcessorFee("paystack", 10_000, "NGN", "THB");
    const local = estimateProcessorFee("paystack", 10_000, "NGN", "NGN");
    assert.ok(foreign > local, `foreign ${foreign} should exceed local ${local}`);
    assert.equal(foreign, 10_000 * 0.039 * 1.075);
  });

  test("the local cap doesn't leak onto international sales", () => {
    // NGN has a ₦2,000 ceiling; international has none, so a large foreign
    // sale must keep scaling.
    const big = estimateProcessorFee("paystack", 1_000_000, "NGN", "THB");
    assert.ok(big > 2_000 * 1.075, "international fee must not be capped");
  });

  test("omitting the event currency falls back to local, not a crash", () => {
    // Older callers pass two arguments. They should keep working.
    assert.equal(estimateProcessorFee("paystack", 10_000, "NGN"), 268.75);
  });
});
