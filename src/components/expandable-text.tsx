"use client";

import { useEffect, useRef, useState } from "react";

// Long event descriptions, clamped with a Show more.
//
// The toggle is only rendered when the text actually overflows, measured after
// layout rather than guessed from character count. A description's height
// depends on line breaks, screen width and font loading, so "longer than 400
// characters" gets it wrong in both directions — a short paragraph with six
// hard line breaks overflows, and a 500-character run-on on a wide screen
// doesn't. A "Show more" that reveals nothing is worse than no toggle at all.
export default function ExpandableText({
  text,
  lines = 6,
  className = "",
}: {
  text: string;
  /** How many lines to show when collapsed. */
  lines?: number;
  className?: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      // scrollHeight is the full text; clientHeight is the clamped box. A
      // couple of pixels of slack keeps sub-pixel line heights from reporting
      // a permanent one-pixel overflow.
      setOverflows(el.scrollHeight > el.clientHeight + 4);
    };

    measure();
    // Rotating a phone or a late web font both change where the text wraps.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => observer.disconnect();
  }, [text]);

  return (
    <div className="space-y-2">
      <p
        ref={ref}
        className={`whitespace-pre-line ${className}`}
        style={
          expanded
            ? undefined
            : {
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: lines,
                overflow: "hidden",
              }
        }
      >
        {text}
      </p>

      {/* Kept mounted once we know it overflows: unmounting it on expand would
          leave no way back to the collapsed state. */}
      {overflows && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-sm font-semibold zv-gradient-text hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
