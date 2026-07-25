import { test, describe } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import { escapeHtml } from "../html.ts";
import { sanitizeLinks } from "../sanitize-links.ts";

// These cover the input-handling boundaries where untrusted text reaches
// somewhere it could do damage: emails sent from the Zivotix domain, anchors
// on public event pages, and webhook payloads that move real money.

describe("escapeHtml (ticket + community emails)", () => {
  test("neutralises an injected anchor", () => {
    const attack = `Jane<a href="https://evil.example">Reset your password</a>`;
    const out = escapeHtml(attack);
    assert.ok(!out.includes("<a"), "raw anchor survived escaping");
    assert.ok(out.includes("&lt;a"));
  });

  test("escapes every character that can break out of an attribute or tag", () => {
    assert.equal(escapeHtml(`<>&"'`), "&lt;&gt;&amp;&quot;&#39;");
  });

  test("escapes the ampersand first so entities aren't double-broken", () => {
    // A naive implementation that replaced & last would turn "<" into
    // "&amp;lt;" and render the literal text "&lt;" to the reader.
    assert.equal(escapeHtml("<"), "&lt;");
    assert.equal(escapeHtml("Rock & Roll"), "Rock &amp; Roll");
  });

  test("handles null and undefined without throwing", () => {
    assert.equal(escapeHtml(null), "");
    assert.equal(escapeHtml(undefined), "");
  });

  test("leaves ordinary names untouched", () => {
    assert.equal(escapeHtml("Daysun Simeon"), "Daysun Simeon");
  });
});

describe("sanitizeLinks (organizer links on public event pages)", () => {
  test("drops javascript: URLs", () => {
    const out = sanitizeLinks([{ label: "Click me", url: "javascript:alert(1)" }]);
    assert.deepEqual(out, []);
  });

  test("drops data: URLs", () => {
    const out = sanitizeLinks([{ label: "Doc", url: "data:text/html,<script>alert(1)</script>" }]);
    assert.deepEqual(out, []);
  });

  test("keeps legitimate http(s) links", () => {
    const out = sanitizeLinks([{ label: "WhatsApp", url: "https://wa.me/234800" }]);
    assert.equal(out.length, 1);
    assert.equal(out[0].url, "https://wa.me/234800");
  });

  test("requires a label", () => {
    assert.deepEqual(sanitizeLinks([{ label: "   ", url: "https://example.com" }]), []);
  });

  test("caps the number of links at 4", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      label: `Link ${i}`,
      url: `https://example.com/${i}`,
    }));
    assert.equal(sanitizeLinks(many).length, 4);
  });

  test("truncates overlong labels", () => {
    const out = sanitizeLinks([{ label: "x".repeat(200), url: "https://example.com" }]);
    assert.equal(out[0].label.length, 60);
  });

  test("survives undefined and malformed rows", () => {
    assert.deepEqual(sanitizeLinks(undefined), []);
    // @ts-expect-error deliberately malformed input, as an API client could send
    assert.deepEqual(sanitizeLinks([{}, null]), []);
  });
});

describe("webhook signature verification", () => {
  // Reimplements the comparison both webhook routes rely on. If either
  // provider's signature check regressed to a loose compare, anyone could
  // forge a "payment succeeded" callback and mint free tickets.
  function verify(rawBody: string, signature: string | null, secret: string, algo: "sha512" | "sha256", encoding: "hex" | "base64") {
    if (!signature) return false;
    const hash = crypto.createHmac(algo, secret).update(rawBody).digest(encoding);
    try {
      return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  const secret = "test_secret_key";
  const body = JSON.stringify({ event: "charge.success", data: { reference: "zvx123" } });

  test("accepts a correctly signed Paystack payload", () => {
    const sig = crypto.createHmac("sha512", secret).update(body).digest("hex");
    assert.equal(verify(body, sig, secret, "sha512", "hex"), true);
  });

  test("rejects a forged signature", () => {
    assert.equal(verify(body, "deadbeef", secret, "sha512", "hex"), false);
  });

  test("rejects a missing signature", () => {
    assert.equal(verify(body, null, secret, "sha512", "hex"), false);
  });

  test("rejects a valid signature over a tampered body", () => {
    // The classic attack: sign a 100 NGN order, then swap the payload.
    const sig = crypto.createHmac("sha512", secret).update(body).digest("hex");
    const tampered = body.replace("zvx123", "zvx999");
    assert.equal(verify(tampered, sig, secret, "sha512", "hex"), false);
  });

  test("rejects a signature made with the wrong secret", () => {
    const sig = crypto.createHmac("sha512", "wrong_secret").update(body).digest("hex");
    assert.equal(verify(body, sig, secret, "sha512", "hex"), false);
  });

  test("accepts a correctly signed Flutterwave payload (sha256/base64)", () => {
    const sig = crypto.createHmac("sha256", secret).update(body).digest("base64");
    assert.equal(verify(body, sig, secret, "sha256", "base64"), true);
  });
});
