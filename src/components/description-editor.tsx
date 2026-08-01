"use client";

import { useRef } from "react";

// A textarea that can bold things.
//
// Deliberately still a textarea rather than a contenteditable rich editor.
// contenteditable brings paste sanitising, cursor bugs on Android keyboards,
// and a document model that has to be serialised somewhere — a lot of surface
// area for "make this word bold". Wrapping the selection in ** costs none of
// that, survives copy-paste into any other app, and leaves the description a
// plain string in the database that the AI generator can still write into.

type Wrap = { before: string; after: string };
type Prefix = { prefix: string };
type Action = Wrap | Prefix;

function isWrap(a: Action): a is Wrap {
  return "before" in a;
}

export default function DescriptionEditor({
  value,
  onChange,
  placeholder,
  className = "zv-input min-h-40 leading-relaxed",
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function apply(action: Action) {
    const el = ref.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);

    if (isWrap(action)) {
      const { before, after } = action;
      // Toggling: if the selection is already wrapped, unwrap it. Without this
      // the bold button is a one-way door and a second press gives ****word****.
      const already =
        value.slice(Math.max(0, start - before.length), start) === before &&
        value.slice(end, end + after.length) === after;

      if (already) {
        const next =
          value.slice(0, start - before.length) + selected + value.slice(end + after.length);
        onChange(next);
        queueMicrotask(() => {
          el.focus();
          el.setSelectionRange(start - before.length, end - before.length);
        });
        return;
      }

      // Nothing selected: drop the markers in and put the cursor between them
      // so the next keystroke is already bold.
      const body = selected || "";
      const next = value.slice(0, start) + before + body + after + value.slice(end);
      onChange(next);
      queueMicrotask(() => {
        el.focus();
        el.setSelectionRange(start + before.length, start + before.length + body.length);
      });
      return;
    }

    // Line prefixes (bullets, headings) apply to every line the selection
    // touches, not just the character range — selecting halfway through three
    // lines and pressing "list" should give three bullets.
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEndIndex = value.indexOf("\n", end);
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
    const chunk = value.slice(lineStart, lineEnd);

    const lines = chunk.split("\n");
    const allPrefixed = lines.every((l) => !l.trim() || l.startsWith(action.prefix));
    const updated = lines
      .map((l) => {
        if (!l.trim()) return l;
        return allPrefixed ? l.slice(action.prefix.length) : action.prefix + l;
      })
      .join("\n");

    const next = value.slice(0, lineStart) + updated + value.slice(lineEnd);
    onChange(next);
    queueMicrotask(() => {
      el.focus();
      el.setSelectionRange(lineStart, lineStart + updated.length);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <ToolButton label="Bold" hint="Bold (Ctrl/⌘ B)" onClick={() => apply({ before: "**", after: "**" })}>
          <span className="font-bold">B</span>
        </ToolButton>
        <ToolButton label="Italic" hint="Italic (Ctrl/⌘ I)" onClick={() => apply({ before: "*", after: "*" })}>
          <span className="italic font-serif">I</span>
        </ToolButton>
        <ToolButton label="Heading" hint="Section heading" onClick={() => apply({ prefix: "## " })}>
          <span className="font-bold text-xs">H</span>
        </ToolButton>
        <ToolButton label="Bullet list" hint="Bullet list" onClick={() => apply({ prefix: "- " })}>
          <span className="text-xs">•—</span>
        </ToolButton>
        <span className="text-xs text-neutral-500 ml-1">Select text, then Bold</span>
      </div>

      <textarea
        ref={ref}
        className={className}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // The shortcut people try first, before they look for a button.
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
            e.preventDefault();
            apply({ before: "**", after: "**" });
          }
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") {
            e.preventDefault();
            apply({ before: "*", after: "*" });
          }
        }}
      />
    </div>
  );
}

function ToolButton({
  label,
  hint,
  onClick,
  children,
}: {
  label: string;
  hint: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={hint}
      className="h-8 min-w-8 px-2 rounded-lg bg-white/[0.08] text-neutral-200 hover:bg-white/[0.16] transition-colors flex items-center justify-center"
    >
      {children}
    </button>
  );
}
