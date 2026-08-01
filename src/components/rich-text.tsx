import { parseRichText, type Inline } from "@/lib/rich-text";

// Renders an event description with actual typography.
//
// Everything here is React elements built from a parsed data structure — there
// is no dangerouslySetInnerHTML and no HTML string, so a description containing
// <script> renders as the literal characters. That is the whole reason the
// parser emits data instead of markup.
function InlineRun({ content }: { content: Inline[] }) {
  return (
    <>
      {content.map((node, i) => {
        if (node.type === "bold") {
          // Plain bright white. Yellow was tried and looked wrong in body
          // copy — it competes with the ticket prices, which are the one thing
          // on the page that should be yellow.
          return (
            <strong key={i} className="font-semibold text-neutral-50">
              {node.value}
            </strong>
          );
        }
        if (node.type === "italic") {
          return (
            <em key={i} className="italic">
              {node.value}
            </em>
          );
        }
        // Line breaks inside a paragraph are preserved by whitespace-pre-line
        // on the wrapper rather than by splitting into <br/> here.
        return <span key={i}>{node.value}</span>;
      })}
    </>
  );
}

export default function RichText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const blocks = parseRichText(text);
  if (!blocks.length) return null;

  return (
    <div className={`space-y-4 ${className}`}>
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          // Two levels only. A third would invite an outline structure nobody
          // is going to maintain in a party listing.
          return block.level === 2 ? (
            <h3 key={i} className="text-lg font-bold text-neutral-50 tracking-tight pt-2 first:pt-0">
              <InlineRun content={block.content} />
            </h3>
          ) : (
            <h4 key={i} className="text-sm font-semibold uppercase tracking-wide text-neutral-400 pt-1">
              <InlineRun content={block.content} />
            </h4>
          );
        }

        if (block.type === "list") {
          return (
            <ul key={i} className="space-y-1.5">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-2.5">
                  {/* A styled marker rather than list-disc: it keeps the dot
                      aligned to the first line of a wrapping item instead of
                      letting the browser centre it against the whole block. */}
                  <span aria-hidden="true" className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-400/70" />
                  <span className="flex-1">
                    <InlineRun content={item} />
                  </span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={i} className="whitespace-pre-line">
            <InlineRun content={block.content} />
          </p>
        );
      })}
    </div>
  );
}
