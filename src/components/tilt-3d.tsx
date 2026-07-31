"use client";

import { useEffect, useRef } from "react";

// Gives a card real depth: it leans toward the pointer and a specular
// highlight tracks across it, so the surface reads as a physical thing being
// looked at from an angle rather than a rectangle that grew a shadow.
//
// Done with CSS transforms rather than a 3D library on purpose. A ticketing
// site whose buyers are on mobile data in Lagos and Bangkok cannot justify
// several hundred kilobytes of WebGL to make cards lean — and a canvas can't
// contain real text, links or images, so everything inside would have to be
// rebuilt. Transforms are GPU-composited, cost nothing to ship, and the DOM
// underneath stays exactly as accessible as it was.
//
// Deliberately inert on touch: there's no pointer to lean toward, and a tilt
// that fires on tap just makes the card feel like it wobbled.
export default function Tilt3D({
  children,
  className = "",
  max = 7,
}: {
  children: React.ReactNode;
  className?: string;
  /** Maximum lean in degrees. Past about 10 it stops looking like depth and starts looking broken. */
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || still) return;

    let frame = 0;

    const move = (e: PointerEvent) => {
      // Throttled to one write per frame. Without this a fast pointer queues
      // dozens of style writes per frame and the whole grid janks.
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.style.setProperty("--rx", `${(0.5 - py) * max}deg`);
        el.style.setProperty("--ry", `${(px - 0.5) * max}deg`);
        el.style.setProperty("--gx", `${px * 100}%`);
        el.style.setProperty("--gy", `${py * 100}%`);
        el.style.setProperty("--glare", "1");
      });
    };

    const leave = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
      el.style.setProperty("--glare", "0");
    };

    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [max]);

  return (
    <div ref={ref} className={`zv-tilt ${className}`}>
      <div className="zv-tilt-inner">
        {children}
        <span aria-hidden className="zv-tilt-glare" />
      </div>
    </div>
  );
}
