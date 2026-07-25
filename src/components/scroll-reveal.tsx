"use client";

import { useEffect, useRef, useState } from "react";

// Fades + lifts a section in the first time it scrolls into view. Starts
// invisible on both the server render and the client's first paint (so
// there's no hydration mismatch), then flips visible once observed —
// respects prefers-reduced-motion by skipping straight to visible.
export default function ScrollReveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = setTimeout(() => setVisible(true), 0);
      return () => clearTimeout(id);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`zv-reveal ${visible ? "zv-reveal-visible" : ""} ${className}`}>
      {children}
    </div>
  );
}
