import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { estimateProcessorFee } from "../processor-fees.ts";
import { resolveChargeCurrency, toSubunit, fromSubunit } from "../fx.ts";
import { computeFees } from "../fees.ts";

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
    // A Nigerian buyer should pay in their own currency: it's Paystack's
    // 1.5% local rate rather than 3.9% international, with no bank FX spread.
    assert.equal(resolveChargeCurrency("NGN"), "NGN");
  });

  test("routes every other currency through USD", () => {
    // Paystack cannot charge a card in THB, so a Thai organizer's event
    // must settle in USD. Returning THB here would break checkout outright.
    assert.equal(resolveChargeCurrency("THB"), "USD");
    assert.equal(resolveChargeCurrency("GBP"), "USD");
  });

  test("never returns a currency Paystack can't charge", () => {
    for (const currency of ["NGN", "THB", "GBP", "EUR", "KES", "JPY"]) {
      assert.ok(
        ["NGN", "USD"].includes(resolveChargeCurrency(currency)),
        `unsupported charge currency for ${currency}`
      );
    }
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

describe("webhook payment matching", () => {
  // Mirrors the check in /api/webhooks/flutterwave. A webhook saying
  // "succeeded" is not enough on its own: the amount and currency have to
  // match the order before a ticket is issued, or an underpaid or
  // wrong-currency charge mints a real ticket.
  function paymentMatches(
    received: { amount: number; currency?: string },
    expected: { amount: number; currency: string }
  ) {
    const amountMatches =
      Number.isFinite(received.amount) && Math.abs(received.amount - expected.amount) < 0.01;
    const currencyMatches = !received.currency || received.currency === expected.currency;
    return amountMatches && currencyMatches;
  }

  const expected = { amount: 296.69, currency: "USD" };

  test("accepts an exact match", () => {
    assert.equal(paymentMatches({ amount: 296.69, currency: "USD" }, expected), true);
  });

  test("rejects an underpayment", () => {
    assert.equal(paymentMatches({ amount: 5, currency: "USD" }, expected), false);
    assert.equal(paymentMatches({ amount: 296.5, currency: "USD" }, expected), false);
  });

  test("rejects a different currency", () => {
    // 296 NGN is worth a tiny fraction of 296 USD.
    assert.equal(paymentMatches({ amount: 296.69, currency: "NGN" }, expected), false);
  });

  test("tolerates sub-cent float noise from FX conversion", () => {
    assert.equal(paymentMatches({ amount: 296.689999, currency: "USD" }, expected), true);
  });

  test("rejects a non-numeric amount rather than treating it as zero", () => {
    assert.equal(paymentMatches({ amount: Number("abc"), currency: "USD" }, expected), false);
  });
});

describe("service fees", () => {
  // Zivotix charges a 5% service fee rather than deducting a commission from
  // the organizer. These guard the two things that must never drift: what
  // the buyer is charged, and what the organizer is owed.

  test("pass mode adds the fee on top and pays the organizer in full", () => {
    const f = computeFees(10_000, "pass");
    assert.equal(f.serviceFee, 500);
    assert.equal(f.total, 10_500);
    assert.equal(f.organizerReceives, 10_000);
  });

  test("absorb mode keeps the buyer's price flat and takes it from the organizer", () => {
    const f = computeFees(10_000, "absorb");
    assert.equal(f.serviceFee, 500);
    assert.equal(f.total, 10_000, "buyer must pay exactly the listed price");
    assert.equal(f.organizerReceives, 9_500);
  });

  test("the books balance in both modes", () => {
    for (const mode of ["pass", "absorb"] as const) {
      for (const subtotal of [1, 999.99, 5_000, 123_456.78]) {
        const f = computeFees(subtotal, mode);
        assert.ok(
          Math.abs(f.total - f.organizerReceives - f.serviceFee) < 0.01,
          `total != organizer + fee for ${mode} at ${subtotal}`
        );
        assert.ok(f.organizerReceives >= 0);
        assert.ok(f.serviceFee >= 0);
      }
    }
  });

  test("a free ticket carries no fee in either mode", () => {
    for (const mode of ["pass", "absorb"] as const) {
      const f = computeFees(0, mode);
      assert.equal(f.serviceFee, 0);
      assert.equal(f.total, 0);
      assert.equal(f.organizerReceives, 0);
    }
  });

  test("the fee covers Paystack's cut on a typical local sale", () => {
    // The whole reason the 3% commission was abandoned. At 5% on a ₦10,000
    // ticket the fee has to beat what Paystack takes on the charged total.
    const f = computeFees(10_000, "pass");
    const processorFee = estimateProcessorFee("paystack", f.total, "NGN");
    assert.ok(
      f.serviceFee > processorFee,
      `service fee ${f.serviceFee} did not cover processor fee ${processorFee}`
    );
  });

  test("documents the known loss band around Paystack's flat-fee threshold", () => {
    // Paystack's flat ₦100 starts at a ₦2,500 charge, so a narrow band of
    // face values costs slightly more to process than 5% brings in. Asserted
    // so the gap stays small and visible rather than being discovered later.
    const f = computeFees(2_600, "pass");
    const processorFee = estimateProcessorFee("paystack", f.total, "NGN");
    const shortfall = processorFee - f.serviceFee;
    assert.ok(shortfall > 0, "expected the shortfall this test documents");
    assert.ok(shortfall < 40, `shortfall grew to ${shortfall}, re-examine the fee structure`);
  });
});

describe("payout maths", () => {
  // Mirrors /api/cron/event-payouts and /api/admin/payouts/run. Organizers
  // are paid 100% of orders.base_amount — the service fee never enters
  // gross_sales, so there is nothing left to deduct at payout time.
  function payout(gross: number) {
    return { platformFee: 0, netPayable: Math.round(gross * 100) / 100 };
  }

  test("the organizer receives the whole of gross", () => {
    assert.deepEqual(payout(100_000), { platformFee: 0, netPayable: 100_000 });
  });

  test("nothing is deducted at payout time, at any size", () => {
    for (const gross of [1, 999.99, 8000, 123_456.78]) {
      const { platformFee, netPayable } = payout(gross);
      assert.equal(platformFee, 0, "payouts must not deduct a commission any more");
      assert.ok(Math.abs(netPayable - gross) < 0.01);
    }
  });

  test("a passed-on fee never reduces what the organizer is paid", () => {
    // The failure this guards against: summing the buyer's total into
    // gross_sales, or subtracting the fee twice.
    const f = computeFees(50_000, "pass");
    assert.equal(payout(f.organizerReceives).netPayable, 50_000);
  });
});
