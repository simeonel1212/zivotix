import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { estimateProcessorFee } from "../processor-fees.ts";
import { resolveChargeCurrency, toSubunit, fromSubunit } from "../fx.ts";

// Everything here guards money. A regression in any of it either overcharges
// a buyer, underpays an organizer, or quietly eats the platform's margin.

describe("toSubunit / fromSubunit", () => {
  test("converts major units to the smallest unit for Paystack", () => {
    assert.equal(toSubunit(1), 100);
    assert.equal(toSubunit(8000), 800_000);
  });

  test("rounds to a whole subunit rather than sending a fraction", () => {
    // Paystack rejects non-integer amounts, and float maths routinely
    // produces values like 1234.5699999999999 after an FX conversion.
    assert.equal(toSubunit(12.345), 1235);
    assert.equal(Number.isInteger(toSubunit(0.1 + 0.2)), true);
  });

  test("round-trips without drifting", () => {
    assert.equal(fromSubunit(toSubunit(8000)), 8000);
    assert.equal(fromSubunit(toSubunit(12.34)), 12.34);
  });
});

describe("resolveChargeCurrency", () => {
  test("charges NGN events in NGN", () => {
    assert.equal(resolveChargeCurrency("NGN"), "NGN");
  });

  test("routes every other currency through USD", () => {
    // Paystack cannot charge a card in THB, so a Thai organizer's event
    // must settle in USD. Returning THB here would break checkout outright.
    assert.equal(resolveChargeCurrency("THB"), "USD");
    assert.equal(resolveChargeCurrency("GBP"), "USD");
  });
});

describe("estimateProcessorFee", () => {
  test("Flutterwave takes a flat 4.8%", () => {
    assert.equal(estimateProcessorFee("flutterwave", 10_000, "NGN"), 480);
  });

  test("Paystack applies 1.5% plus VAT, with the flat fee waived under 2500 NGN", () => {
    // 2000 * 1.5% = 30, no flat fee below 2500, +7.5% VAT = 32.25
    assert.equal(estimateProcessorFee("paystack", 2000, "NGN"), 32.25);
  });

  test("Paystack adds the flat 100 NGN fee at or above 2500", () => {
    // 3000 * 1.5% = 45, +100 flat = 145, +7.5% VAT = 155.88 (rounded)
    assert.equal(estimateProcessorFee("paystack", 3000, "NGN"), 155.88);
  });

  test("Paystack fee is capped so large sales aren't overcharged", () => {
    // Without the 2000 cap, a 1,000,000 NGN sale would be charged ~15,100.
    const fee = estimateProcessorFee("paystack", 1_000_000, "NGN");
    assert.equal(fee, 2150); // 2000 cap + 7.5% VAT
    assert.ok(fee < 1_000_000 * 0.015);
  });

  test("never returns more than the sale itself", () => {
    for (const amount of [1, 50, 999, 12_345, 5_000_000]) {
      for (const provider of ["paystack", "flutterwave"] as const) {
        const fee = estimateProcessorFee(provider, amount, "NGN");
        assert.ok(fee >= 0, `${provider} fee went negative at ${amount}`);
        assert.ok(fee < amount, `${provider} fee exceeded the sale at ${amount}`);
      }
    }
  });
});

describe("payout maths", () => {
  // Mirrors the calculation in /api/cron/event-payouts and
  // /api/admin/payouts/run. The organizer's contract is a fixed percentage
  // of gross; the processor fee comes out of the platform's share, never
  // theirs.
  function payout(gross: number, commissionRate: number) {
    const platformFee = Math.round(gross * commissionRate * 100) / 100;
    const netPayable = Math.round((gross - platformFee) * 100) / 100;
    return { platformFee, netPayable };
  }

  test("splits gross by the commission rate", () => {
    assert.deepEqual(payout(100_000, 0.1), { platformFee: 10_000, netPayable: 90_000 });
  });

  test("a platform-owned event takes no commission", () => {
    assert.deepEqual(payout(50_000, 0), { platformFee: 0, netPayable: 50_000 });
  });

  test("fee and payout always reconcile back to gross", () => {
    for (const gross of [1, 999.99, 8000, 123_456.78]) {
      for (const rate of [0, 0.05, 0.1, 0.25]) {
        const { platformFee, netPayable } = payout(gross, rate);
        assert.ok(
          Math.abs(platformFee + netPayable - gross) < 0.01,
          `payout didn't reconcile for gross=${gross} rate=${rate}`
        );
        assert.ok(netPayable >= 0, `organizer payout went negative at rate=${rate}`);
      }
    }
  });

  test("commission below the processor floor loses the platform money", () => {
    // This is the known open issue: net_payable is computed off gross, so a
    // commission under Flutterwave's 4.8% means paying out more than the
    // sale actually delivered. Asserted so the behaviour is documented and
    // a future fix has a failing case to flip.
    const gross = 10_000;
    const { platformFee, netPayable } = payout(gross, 0.03); // 3% commission
    const processorFee = estimateProcessorFee("flutterwave", gross, "NGN");
    const actuallyReceived = gross - processorFee;
    assert.ok(netPayable > actuallyReceived, "expected the shortfall this test documents");
    assert.ok(platformFee < processorFee);
  });
});
