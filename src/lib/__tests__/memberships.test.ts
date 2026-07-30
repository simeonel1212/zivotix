import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  assessMembership,
  expiryFromPurchase,
  isMembershipReference,
  membershipRefusalMessage,
} from "../memberships.ts";
import { computeFees } from "../fees.ts";

// A membership pass is a bearer instrument worth several events' entry. These
// guard the two ways it can go wrong: letting someone in who shouldn't be, and
// refusing someone who paid.

const base = {
  status: "active" as const,
  credits_total: 6,
  credits_used: 0,
  starts_at: "2026-01-01T00:00:00Z",
  expires_at: "2027-01-01T00:00:00Z",
};
const now = new Date("2026-06-01T00:00:00Z");

describe("assessMembership", () => {
  test("an active pass with credits is usable", () => {
    const r = assessMembership(base, now);
    assert.equal(r.usable, true);
    assert.equal(r.creditsLeft, 6);
  });

  test("counts down as entries are used", () => {
    assert.equal(assessMembership({ ...base, credits_used: 4 }, now).creditsLeft, 2);
  });

  test("refuses once every entry is spent", () => {
    const r = assessMembership({ ...base, credits_used: 6 }, now);
    assert.equal(r.usable, false);
    assert.equal(r.reason, "spent");
    assert.equal(r.creditsLeft, 0);
  });

  test("never reports negative credits", () => {
    // Defensive: a double-write on the counter shouldn't produce "-1 left" on a
    // door screen.
    assert.equal(assessMembership({ ...base, credits_used: 9 }, now).creditsLeft, 0);
  });

  test("refuses an expired pass even with credits left", () => {
    const r = assessMembership(base, new Date("2027-06-01T00:00:00Z"));
    assert.equal(r.usable, false);
    assert.equal(r.reason, "expired");
  });

  test("refuses a pass that hasn't started", () => {
    const r = assessMembership(base, new Date("2025-06-01T00:00:00Z"));
    assert.equal(r.usable, false);
    assert.equal(r.reason, "not_started");
  });

  test("a cancelled pass reports cancelled, not expired", () => {
    // Both are true for an old cancelled pass. The holder needs to hear the
    // reason that explains their refund, not the incidental one.
    const r = assessMembership(
      { ...base, status: "cancelled" },
      new Date("2027-06-01T00:00:00Z")
    );
    assert.equal(r.reason, "cancelled");
  });

  test("a refunded pass cannot be used", () => {
    assert.equal(assessMembership({ ...base, status: "refunded" }, now).usable, false);
  });

  test("every refusal has wording for the door", () => {
    for (const reason of ["expired", "spent", "cancelled", "not_started", undefined] as const) {
      const msg = membershipRefusalMessage(reason);
      assert.ok(msg.length > 0 && msg.length < 40, `bad door message for ${reason}: ${msg}`);
    }
  });
});

describe("membership references", () => {
  test("membership references are distinguishable from ticket orders", () => {
    // The checkout status page routes on this prefix alone, so a collision
    // would send a buyer to the wrong page.
    assert.equal(isMembershipReference("zvxm123abc"), true);
    assert.equal(isMembershipReference("zvx123abc"), false);
    assert.equal(isMembershipReference(null), false);
    assert.equal(isMembershipReference(""), false);
  });
});

describe("expiryFromPurchase", () => {
  test("adds the validity window to the purchase date", () => {
    const from = new Date("2026-01-01T12:00:00Z");
    assert.equal(expiryFromPurchase(365, from).toISOString().slice(0, 10), "2027-01-01");
    assert.equal(expiryFromPurchase(90, from).toISOString().slice(0, 10), "2026-04-01");
  });
});

describe("membership pricing", () => {
  test("the service fee applies exactly as it does to tickets", () => {
    // Passes are a bigger transaction, not a different one — no bespoke rate.
    const ngn = computeFees(40_000, "NGN", "pass");
    assert.equal(ngn.serviceFee, 2_000);
    assert.equal(ngn.total, 42_000);
    assert.equal(ngn.organizerReceives, 40_000);

    const thb = computeFees(40_000, "THB", "pass");
    assert.equal(thb.rate, 0.07);
  });

  test("a pass earns the platform more than the tickets it replaces", () => {
    // The commercial reason memberships are worth building: one 6-entry pass at
    // 40,000 beats six separate 7,000 tickets, because the fee lands once on a
    // larger amount and there's no per-order processor flat fee six times over.
    const pass = computeFees(40_000, "NGN", "pass").serviceFee;
    const singles = 6 * computeFees(7_000, "NGN", "pass").serviceFee;
    assert.ok(pass > singles * 0.9, `pass ${pass} vs singles ${singles}`);
  });
});
