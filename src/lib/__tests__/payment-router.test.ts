import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { resolvePaymentRoute, routeChain, fallbackRoute } from "../payment-router.ts";
import { flutterwaveCollects, flutterwaveV3Configured } from "../flutterwave-v3.ts";
import { WORLD_CURRENCIES } from "../currencies.ts";

// The 1 August outage in one sentence: a currency was chosen that the merchant
// account could not collect, and nothing downstream could tell the difference
// until Paystack refused the transaction in front of a buyer. These tests
// exist to make that specific mistake loud.

const KEY = "FLUTTERWAVE_SECRET_KEY";
let original: string | undefined;

beforeEach(() => {
  original = process.env[KEY];
});
afterEach(() => {
  if (original === undefined) delete process.env[KEY];
  else process.env[KEY] = original;
});

describe("with Flutterwave switched off", () => {
  beforeEach(() => {
    delete process.env[KEY];
  });

  test("the rail reports itself as unconfigured", () => {
    assert.equal(flutterwaveV3Configured(), false);
  });

  test("every currency still settles the way it does today", () => {
    // The safety property of shipping this before the key exists: nothing
    // about live checkout changes until someone deliberately turns it on.
    for (const currency of WORLD_CURRENCIES) {
      const route = resolvePaymentRoute(currency);
      assert.equal(route.provider, "paystack", `${currency} must stay on Paystack`);
      assert.equal(route.chargeCurrency, "NGN", `${currency} must charge in NGN`);
    }
  });
});

describe("with Flutterwave switched on", () => {
  beforeEach(() => {
    process.env[KEY] = "FLWSECK-test-not-a-real-key";
  });

  test("naira stays on Paystack", () => {
    // Not inertia: Paystack's local rate caps at ₦2,000 and Flutterwave's
    // doesn't, so moving naira across would cost money to fix nothing.
    const route = resolvePaymentRoute("NGN");
    assert.equal(route.provider, "paystack");
    assert.equal(route.chargeCurrency, "NGN");
  });

  test("a currency Flutterwave collects is charged in that currency", () => {
    const route = resolvePaymentRoute("GBP");
    assert.equal(route.provider, "flutterwave");
    assert.equal(route.chargeCurrency, "GBP");
  });

  test("baht is charged in dollars, and naira is only ever the last resort", () => {
    // THB is deliberately not on the collectable list: dollars is a currency
    // every issuer converts cleanly, and the USD figure is shown at checkout
    // before the buyer commits. Naira stays in the chain but underneath.
    assert.equal(flutterwaveCollects("THB"), false);
    const chain = routeChain("THB");
    assert.deepEqual(
      chain.map((r) => `${r.provider}:${r.chargeCurrency}`),
      ["flutterwave:USD", "paystack:NGN"]
    );
  });

  test("a currency Flutterwave takes natively still has dollars beneath it", () => {
    const chain = routeChain("GBP");
    assert.equal(chain[0].chargeCurrency, "GBP");
    assert.equal(chain[1].chargeCurrency, "USD");
    assert.equal(chain[chain.length - 1].provider, "paystack");
  });

  test("dollars are never attempted twice", () => {
    // USD is both the preferred route and the intermediate fallback, so a
    // naive chain would retry the identical request after it just failed.
    const chain = routeChain("USD");
    const usd = chain.filter((r) => r.chargeCurrency === "USD");
    assert.equal(usd.length, 1);
  });

  test("naira is always the last resort and never the first", () => {
    for (const currency of WORLD_CURRENCIES) {
      const chain = routeChain(currency);
      const last = chain[chain.length - 1];
      assert.equal(last.provider, "paystack");
      assert.equal(last.chargeCurrency, "NGN");
      if (currency !== "NGN") {
        assert.equal(chain[0].provider, "flutterwave", `${currency} should try Flutterwave first`);
      }
    }
  });

  test("no currency is ever routed to a processor in a currency it can't take", () => {
    // The assertion that would have caught the outage, generalised.
    for (const currency of WORLD_CURRENCIES) {
      const route = resolvePaymentRoute(currency);
      if (route.provider === "paystack") {
        assert.equal(route.chargeCurrency, "NGN", `Paystack can only take NGN, got ${route.chargeCurrency}`);
      } else {
        assert.ok(
          flutterwaveCollects(route.chargeCurrency),
          `Flutterwave cannot collect ${route.chargeCurrency} (from ${currency})`
        );
      }
    }
  });

  test("every route has a human-readable reason", () => {
    // These land in logs and in support conversations. An empty string here
    // means an outage gets debugged by reading the router instead of the logs.
    for (const currency of ["NGN", "GBP", "THB", "USD"]) {
      assert.ok(resolvePaymentRoute(currency).reason.length > 10);
    }
  });
});

describe("routing by where the buyer is", () => {
  beforeEach(() => {
    process.env[KEY] = "FLWSECK-test-not-a-real-key";
  });

  test("a Nigerian buyer pays in naira even for a foreign event", () => {
    // Nigerian banks block international transactions on naira cards, so a
    // dollar charge is declined by the issuer with "Restricted card". The
    // route chain cannot rescue that — it catches a processor refusing at
    // checkout, not a bank declining after the card is entered.
    const chain = routeChain("THB", "NG");
    assert.deepEqual(
      chain.map((r) => `${r.provider}:${r.chargeCurrency}`),
      ["paystack:NGN"]
    );
  });

  test("an American buying a Thai event is charged in dollars", () => {
    // Their own currency, no conversion on their side at all.
    const route = resolvePaymentRoute("THB", "US");
    assert.equal(route.provider, "flutterwave");
    assert.equal(route.chargeCurrency, "USD");
  });

  test("a Thai buyer is unaffected by the Nigerian carve-out", () => {
    assert.equal(resolvePaymentRoute("THB", "TH").chargeCurrency, "USD");
  });

  test("an unknown country falls back to deciding on the event alone", () => {
    // VPNs, crawlers and local development strip the geo header. Null must
    // behave exactly as it did before buyer country was considered.
    assert.deepEqual(routeChain("THB", null), routeChain("THB"));
  });

  test("the carve-out is case-insensitive", () => {
    assert.equal(resolvePaymentRoute("THB", "ng").chargeCurrency, "NGN");
  });

  test("a Nigerian event is unaffected wherever the buyer is", () => {
    for (const country of ["NG", "US", "TH", null]) {
      assert.equal(resolvePaymentRoute("NGN", country).chargeCurrency, "NGN");
    }
  });
});

describe("the fallback", () => {
  test("is the one route with completed payments behind it", () => {
    const fb = fallbackRoute();
    assert.equal(fb.provider, "paystack");
    assert.equal(fb.chargeCurrency, "NGN");
  });

  test("differs from the preferred route whenever there is something to fall back from", () => {
    // startPayment only retries when the fallback isn't the route that just
    // failed. If these ever coincide for a foreign currency, a Flutterwave
    // refusal would surface to the buyer instead of being absorbed.
    process.env[KEY] = "FLWSECK-test-not-a-real-key";
    const preferred = resolvePaymentRoute("GBP");
    const fb = fallbackRoute();
    assert.notEqual(
      `${preferred.provider}:${preferred.chargeCurrency}`,
      `${fb.provider}:${fb.chargeCurrency}`
    );
  });
});
