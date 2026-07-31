import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatMoney } from "../currencies.ts";

describe("formatMoney", () => {
  test("uses the real symbol where it's unique", () => {
    assert.equal(formatMoney(10000, "NGN"), "₦10,000");
    assert.equal(formatMoney(500, "THB"), "฿500");
    assert.equal(formatMoney(1000, "INR"), "₹1,000");
    assert.equal(formatMoney(50, "GBP"), "£50");
    assert.equal(formatMoney(50, "EUR"), "€50");
  });

  test("disambiguates the dollar family", () => {
    // The whole reason this isn't a plain narrowSymbol call: a Sydney event
    // advertising "$50" would be read as US dollars by half the internet.
    assert.equal(formatMoney(50, "USD"), "$50");
    assert.ok(formatMoney(50, "AUD").startsWith("A$"), formatMoney(50, "AUD"));
    assert.ok(formatMoney(50, "CAD").startsWith("CA$"), formatMoney(50, "CAD"));
    assert.notEqual(formatMoney(50, "AUD"), formatMoney(50, "USD"));
    assert.notEqual(formatMoney(50, "CAD"), formatMoney(50, "SGD"));
  });

  test("shows decimals only when the amount has them", () => {
    assert.equal(formatMoney(12.5, "USD"), "$12.50");
    assert.equal(formatMoney(12, "USD"), "$12");
    assert.equal(formatMoney(0, "NGN"), "₦0");
  });

  test("is case-insensitive about the code", () => {
    assert.equal(formatMoney(100, "ngn"), formatMoney(100, "NGN"));
  });

  test("falls back rather than throwing on a bad code", () => {
    const result = formatMoney(100, "NOTACURRENCY");
    assert.ok(result.includes("100"));
    assert.ok(result.includes("NOTACURRENCY"));
  });

  test("groups thousands", () => {
    assert.equal(formatMoney(1234567, "NGN"), "₦1,234,567");
  });
});
