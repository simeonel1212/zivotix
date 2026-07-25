"use client";

import { useEffect, useState } from "react";

// One-shot confetti rain for the "you bought a ticket" moment. Pieces are
// randomized client-side only (in useEffect, not during render) so the
// server-rendered HTML and the client's first render both start out empty —
// generating random values during render would mismatch between the two and
// trip a hydration error.
const COLORS = ["#facc15", "#eab308", "#fde047", "#ca8a04", "#fbbf24"];
const PIECE_COUNT = 28;

interface Piece {
  left: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  rotate: number;
}

export default function ConfettiBurst() {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Deferred a tick (rather than calling setState directly in the effect
    // body) so this doesn't trigger a synchronous cascading render.
    const id = setTimeout(() => {
      setPieces(
        Array.from({ length: PIECE_COUNT }, (_, i) => ({
          left: Math.random() * 100,
          delay: Math.random() * 0.4,
          duration: 2.2 + Math.random() * 1.4,
          size: 6 + Math.random() * 6,
          color: COLORS[i % COLORS.length],
          rotate: Math.random() * 360,
        }))
      );
    }, 0);
    return () => clearTimeout(id);
  }, []);

  if (pieces.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: "-5vh",
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.4,
            background: p.color,
            borderRadius: 2,
            transform: `rotate(${p.rotate}deg)`,
            animation: `zv-confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}
