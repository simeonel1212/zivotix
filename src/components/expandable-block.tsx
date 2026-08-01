"use client";

import { useEffect, useRef, useState } from "react";

// Clamps arbitrary content — headings, lists, paragraphs — behind a Show more.
//
// Separate from ExpandableText because the two clamp differently and neither
// technique works for the other's job. -webkit-line-clamp only applies to a
// single run of text, so it silently does nothing once the content contains
// block children. This clamps to a pixel height instead, with a fade so the
// cut looks deliberate rather than like a rendering bug.
//
// Overflow is measured after layout rather than guessed from length: whether
// a description overflows depends on line breaks, screen width and when the
// web font loads, and a "Show more" that reveals nothing is worse than none.
export default function ExpandableBlock({
  children,
  maxHeight = 340,
  className = "",
}: {
  children: React.ReactNode;
  /** Collapsed height in pixels. */
  maxHeight?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => setOverflows(el.scrollHeight > maxHeight + 8);

    measure();
    // Rotating a phone, a late web font, or an image loading inside the block
    // all change where the content ends.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => observer.disconnect();
  }, [maxHeight, children]);

  const collapsed = overflows && !expanded;

  return (
    <div className={className}>
      <div className="relative">
        <div
          ref={ref}
          style={collapsed ? { maxHeight, overflow: "hidden" } : undefined}
        >
          {children}
        </div>

        {collapsed && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0f0f10] to-transparent"
          />
        )}
      </div>

      {/* Kept mounted once we know it overflows: unmounting on expand would
          leave no way back to the collapsed state. */}
      {overflows && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-sm font-semibold zv-gradient-text hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
