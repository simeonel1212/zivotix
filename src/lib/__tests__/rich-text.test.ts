import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseRichText, parseInline, richTextToPlain } from "../rich-text.ts";

describe("existing descriptions, untouched", () => {
  // The whole point of choosing a Markdown subset: every description already
  // in the database has to look better without anyone editing it.
  const real = `Join us every Thursday & Sunday for Phuket's most talked-about nightlife experience.

Terms & Conditions

Tickets & Wristbands
• Ticket will be redeemed once at the gate in exchange for a wristband.
• Entry may be refused if tickets are damaged or defaced.
• Tickets are non-refundable under all circumstances.`;

  test("the • bullets people actually type become a list", () => {
    const blocks = parseRichText(real);
    const lists = blocks.filter((b) => b.type === "list");
    assert.equal(lists.length, 1);
    assert.equal(lists[0].type === "list" && lists[0].items.length, 3);
  });

  test("blank lines separate paragraphs", () => {
    const paragraphs = parseRichText(real).filter((b) => b.type === "paragraph");
    assert.ok(paragraphs.length >= 2);
  });

  test("nothing is lost", () => {
    // Whatever the formatting does, every word survives the round trip.
    const plain = richTextToPlain(real);
    for (const word of ["Phuket's", "wristband", "non-refundable"]) {
      assert.ok(plain.includes(word), `lost "${word}"`);
    }
  });
});

describe("emphasis", () => {
  test("**bold** becomes bold", () => {
    assert.deepEqual(parseInline("Arrive **before 11PM**"), [
      { type: "text", value: "Arrive " },
      { type: "bold", value: "before 11PM" },
    ]);
  });

  test("bold wins over italic on a double asterisk", () => {
    // Parsed the other way round, "**x**" leaves a stray asterisk either side.
    const nodes = parseInline("**x**");
    assert.deepEqual(nodes, [{ type: "bold", value: "x" }]);
  });

  test("a lone asterisk is left alone", () => {
    // "5 * 3" and "‼️*important*" both occur in real listings; only the second
    // is emphasis, and an unmatched marker must never eat the rest of the line.
    assert.deepEqual(parseInline("2 * 3 = 6"), [{ type: "text", value: "2 * 3 = 6" }]);
  });

  test("emphasis works inside a bullet", () => {
    const blocks = parseRichText("- Includes **free flow prosecco**");
    assert.equal(blocks[0].type, "list");
    assert.ok(
      blocks[0].type === "list" && blocks[0].items[0].some((n) => n.type === "bold")
    );
  });
});

describe("structure", () => {
  test("## makes a heading, and it ends the paragraph before it", () => {
    const blocks = parseRichText("Some intro\n## Event Details\nDoors at 10");
    assert.deepEqual(
      blocks.map((b) => b.type),
      ["paragraph", "heading", "paragraph"]
    );
  });

  test("single newlines inside a paragraph are kept", () => {
    // People press Enter to mean "new line". Markdown's usual rule collapses
    // that, which would reflow a carefully broken lineup into one blob.
    const blocks = parseRichText("10:00 PM – 4:00 AM\nMamba Phuket");
    assert.equal(blocks.length, 1);
    assert.ok(blocks[0].type === "paragraph" && blocks[0].content[0].value.includes("\n"));
  });

  test("an empty description produces no blocks", () => {
    assert.deepEqual(parseRichText(""), []);
    assert.deepEqual(parseRichText("   \n\n  "), []);
  });
});

describe("safety", () => {
  test("HTML is never markup, only text", () => {
    // The parser emits data and React renders it as elements, so there is no
    // HTML string anywhere. This asserts the tag survives as literal content
    // rather than being stripped — stripping would imply a sanitiser exists,
    // and a sanitiser is a thing that can be wrong.
    const blocks = parseRichText('<script>alert("x")</script>');
    assert.equal(blocks.length, 1);
    assert.equal(richTextToPlain('<script>alert("x")</script>'), '<script>alert("x")</script>');
  });

  test("plain text output carries no leftover markers", () => {
    const plain = richTextToPlain("## Details\n- **Bold** item\n\nBody *text*");
    assert.ok(!plain.includes("**"), plain);
    assert.ok(!plain.includes("##"), plain);
  });
});
