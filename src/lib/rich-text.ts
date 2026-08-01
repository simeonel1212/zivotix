// A deliberately small Markdown subset for event descriptions.
//
// Why a subset and not a real editor: descriptions are written once, on a
// phone, by someone who is not a designer. Bold, headings and bullets cover
// what an event listing actually needs — a lineup, a dress code, a list of
// terms. Tables, images and links inside text do not, and every extra feature
// is another way for a listing to end up ugly.
//
// Why Markdown and not HTML: HTML in a public listing means sanitising it, and
// a sanitiser is a security dependency that has to stay correct forever. This
// parser emits a plain data structure that React renders as elements, so there
// is no HTML string anywhere and nothing to sanitise. A description containing
// <script> renders as the literal text "<script>".
//
// It is also backwards compatible on purpose. Every description already in the
// database is plain text with blank lines and "•" bullets, and it parses into
// paragraphs and lists without anyone editing anything.

export type Inline =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string };

export type Block =
  | { type: "heading"; level: 2 | 3; content: Inline[] }
  | { type: "paragraph"; content: Inline[] }
  | { type: "list"; items: Inline[][] };

// Bullets people actually type. "-" and "*" are Markdown; "•" is what you get
// from a phone keyboard or a paste out of Notes, and it is what every existing
// description in this database uses.
const BULLET = /^\s*([-*•‣·])\s+(.*)$/;
const HEADING = /^\s*(#{1,3})\s+(.*)$/;

// Inline emphasis. **bold** first so that the italic pass can't claim the
// inner pair of asterisks and leave a stray one behind.
const INLINE = /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;

  for (const m of text.matchAll(INLINE)) {
    const index = m.index ?? 0;
    if (index > last) out.push({ type: "text", value: text.slice(last, index) });
    if (m[2] !== undefined) out.push({ type: "bold", value: m[2] });
    else if (m[4] !== undefined) out.push({ type: "italic", value: m[4] });
    last = index + m[0].length;
  }

  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  // An empty run would render as nothing at all; a single empty text node keeps
  // the paragraph's height and its spacing.
  return out.length ? out : [{ type: "text", value: text }];
}

export function parseRichText(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = (source ?? "").replace(/\r\n?/g, "\n").split("\n");

  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    // Single newlines inside a paragraph are kept as line breaks rather than
    // collapsed. People writing an event listing use Enter to mean "new line",
    // not "same sentence continues", and honouring Markdown's collapsing rule
    // here would silently reflow their carefully broken lineup into a blob.
    blocks.push({ type: "paragraph", content: parseInline(paragraph.join("\n")) });
    paragraph = [];
  };

  const flushList = () => {
    if (!list.length) return;
    blocks.push({ type: "list", items: list.map(parseInline) });
    list = [];
  };

  for (const line of lines) {
    const heading = HEADING.exec(line);
    const bullet = BULLET.exec(line);

    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        level: heading[1].length === 1 ? 2 : 3,
        content: parseInline(heading[2].trim()),
      });
      continue;
    }

    if (bullet) {
      flushParagraph();
      list.push(bullet[2].trim());
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

/**
 * Strips formatting down to readable plain text.
 *
 * For meta descriptions and share cards, where "**Free flow prosecco**" would
 * appear with its asterisks in a Google result.
 */
export function richTextToPlain(source: string): string {
  return parseRichText(source)
    .map((block) => {
      if (block.type === "list") {
        return block.items.map((item) => `• ${inlineToPlain(item)}`).join("\n");
      }
      return inlineToPlain(block.content);
    })
    .join("\n\n")
    .trim();
}

function inlineToPlain(content: Inline[]): string {
  return content.map((n) => n.value).join("");
}
