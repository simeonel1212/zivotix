import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  assessMembership,
  expiryFromMonths,
  membershipShapeLabel,
  isUnlimited,
} from "../memberships.ts";

const base = {
  status: "active" as const,
  credits_used: 0,
  starts_at: "2026-01-01T00:00:00Z",
  expires_at: "2026-12-31T00:00:00Z",
};

describe("period (unlimited) passes", () => {
  test("a null credit total means unlimited, not spent", () => {
    const state = assessMembership({ ...base, credits_total: null, credits_used: 40 });
    assert.equal(state.usable, true);
    assert.equal(state.creditsLeft, null);
    assert.equal(state.reason, undefined);
  });

  test("a zero credit total is still spent", () => {
    // The distinction the whole feature rests on: 0 is a used-up punch card,
    // null is a season ticket. Conflating them breaks one or the other.
    const state = assessMembership({ ...base, credits_total: 6, credits_used: 6 });
    assert.equal(state.usable, false);
    assert.equal(state.reason, "spent");
  });

  test("unlimited still expires", () => {
    const state = assessMembership(
      { ...base, credits_total: null },
      new Date("2027-01-05T00:00:00Z")
    );
    assert.equal(state.usable, false);
    assert.equal(state.reason, "expired");
  });

  test("unlimited still respects cancellation", () => {
    const state = assessMembership({ ...base, credits_total: null, status: "refunded" });
    assert.equal(state.usable, false);
    assert.equal(state.reason, "cancelled");
  });

  test("isUnlimited reads the same signal", () => {
    assert.equal(isUnlimited({ credits_total: null }), true);
    assert.equal(isUnlimited({ credits_total: 0 }), false);
  });
});

describe("expiryFromMonths", () => {
  test("lands on the same date next month", () => {
    assert.equal(expiryFromMonths(1, new Date("2026-03-15T10:00:00Z")).getDate(), 15);
    assert.equal(expiryFromMonths(3, new Date("2026-01-10T10:00:00Z")).getMonth(), 3); // April
  });

  test("clamps rather than overflowing into the next month", () => {
    // setMonth alone turns 31 Jan + 1 month into 3 March. A member joining on
    // the 31st should get the last day of February, not a date in March.
    const d = expiryFromMonths(1, new Date(2026, 0, 31));
    assert.equal(d.getMonth(), 1, "should be February");
    assert.equal(d.getDate(), 28);
  });

  test("crosses the year boundary", () => {
    const d = expiryFromMonths(3, new Date(2026, 10, 15)); // 15 Nov
    assert.equal(d.getFullYear(), 2027);
    assert.equal(d.getMonth(), 1); // February
  });

  test("twelve months is a year later", () => {
    const d = expiryFromMonths(12, new Date(2026, 5, 9));
    assert.equal(d.getFullYear(), 2027);
    assert.equal(d.getMonth(), 5);
    assert.equal(d.getDate(), 9);
  });
});

describe("membershipShapeLabel", () => {
  test("describes each kind in the buyer's terms", () => {
    assert.equal(
      membershipShapeLabel({
        kind: "period",
        event_credits: null,
        validity_months: 3,
        validity_days: 93,
      }),
      "Unlimited entry for 3 months"
    );
    assert.equal(
      membershipShapeLabel({
        kind: "period",
        event_credits: null,
        validity_months: 1,
        validity_days: 31,
      }),
      "Unlimited entry for 1 month"
    );
    assert.equal(
      membershipShapeLabel({
        kind: "credits",
        event_credits: 6,
        validity_months: null,
        validity_days: 365,
      }),
      "6 events"
    );
  });
});
