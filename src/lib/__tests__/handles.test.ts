import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { normaliseHandle, validateHandle, isReservedHandle } from "../handles.ts";

describe("organizer handles", () => {
  test("normalises what a person is likely to type", () => {
    assert.equal(normaliseHandle("  Eden Lagos  "), "eden-lagos");
    assert.equal(normaliseHandle("Eden!!!Lagos"), "eden-lagos");
    assert.equal(normaliseHandle("--eden--"), "eden");
    assert.equal(normaliseHandle("EDEN"), "eden");
  });

  test("caps length so it can't exceed the column constraint", () => {
    assert.equal(normaliseHandle("a".repeat(80)).length, 30);
  });

  test("a handle that normalises to nothing is empty, not garbage", () => {
    assert.equal(normaliseHandle("!!!"), "");
    assert.equal(normaliseHandle("---"), "");
  });

  test("accepts ordinary handles", () => {
    for (const h of ["eden", "eden-lagos", "eden_2026", "a1b"]) {
      assert.equal(validateHandle(h).ok, true, h);
    }
  });

  test("rejects too short, too long, and bad edges", () => {
    assert.equal(validateHandle("ab").ok, false);
    assert.equal(validateHandle("a".repeat(31)).ok, false);
    assert.equal(validateHandle("-eden").ok, false);
    assert.equal(validateHandle("eden-").ok, false);
    assert.equal(validateHandle("_eden").ok, false);
  });

  test("reserves route names so a claimed handle can never be shadowed", () => {
    // /events resolves to the real page, so an organizer holding "events"
    // would own a link that silently never works.
    assert.equal(validateHandle("events").ok, false);
    assert.equal(validateHandle("admin").ok, false);
    assert.equal(validateHandle("zivotix").ok, false);
    assert.equal(isReservedHandle("EVENTS"), true);
    assert.equal(isReservedHandle("eden"), false);
  });

  test("every validation failure explains itself", () => {
    for (const h of ["ab", "-eden", "events", "a".repeat(31)]) {
      const result = validateHandle(h);
      assert.equal(result.ok, false, h);
      assert.ok(result.error && result.error.length > 0, h);
    }
  });
});
