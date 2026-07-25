// Decorative layer of floating 3D-style ticket shapes for hero/marketing
// backgrounds. Purely visual — not interactive, so it sits behind content
// with pointer-events disabled and doesn't affect layout or accessibility.

type Ticket = {
  x: number;
  y: number;
  scale: number;
  rotate: number;
  opacity: number;
  from: string;
  to: string;
};

const TICKETS: Ticket[] = [
  { x: 60, y: 90, scale: 1.15, rotate: -18, opacity: 0.5, from: "#fde047", to: "#eab308" },
  { x: 940, y: 60, scale: 0.85, rotate: 22, opacity: 0.45, from: "#fef08a", to: "#facc15" },
  { x: 1080, y: 260, scale: 1.35, rotate: -10, opacity: 0.55, from: "#fbbf24", to: "#ca8a04" },
  { x: 40, y: 340, scale: 0.95, rotate: 14, opacity: 0.4, from: "#fef9c3", to: "#fde047" },
  { x: 820, y: 460, scale: 1.05, rotate: -26, opacity: 0.45, from: "#facc15", to: "#a16207" },
  { x: 200, y: 480, scale: 0.75, rotate: 30, opacity: 0.35, from: "#fbbf24", to: "#eab308" },
  { x: 1150, y: 440, scale: 0.7, rotate: -8, opacity: 0.35, from: "#fde047", to: "#facc15" },
  { x: 500, y: 20, scale: 0.65, rotate: 12, opacity: 0.3, from: "#fef08a", to: "#fbbf24" },
  { x: 640, y: 380, scale: 0.85, rotate: -20, opacity: 0.35, from: "#fde68a", to: "#ca8a04" },
  { x: 350, y: 200, scale: 0.6, rotate: 24, opacity: 0.3, from: "#facc15", to: "#a16207" },
];

export default function TicketBackdrop({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`pointer-events-none absolute inset-0 w-full h-full ${className}`}
      viewBox="0 0 1200 600"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <mask id="zv-ticket-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="56">
          <rect x="0" y="0" width="100" height="56" rx="10" fill="white" />
          <circle cx="0" cy="28" r="8" fill="black" />
          <circle cx="100" cy="28" r="8" fill="black" />
          <line x1="66" y1="8" x2="66" y2="48" stroke="black" strokeWidth="2.5" strokeDasharray="3 4" />
        </mask>
        <filter id="zv-ticket-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="10" stdDeviation="14" floodColor="#92400e" floodOpacity="0.18" />
        </filter>
        {TICKETS.map((t, i) => (
          <linearGradient key={i} id={`zv-ticket-grad-${i}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={t.from} />
            <stop offset="100%" stopColor={t.to} />
          </linearGradient>
        ))}
      </defs>

      {TICKETS.map((t, i) => (
        <g
          key={i}
          transform={`translate(${t.x} ${t.y}) rotate(${t.rotate}) scale(${t.scale})`}
          opacity={t.opacity}
          filter="url(#zv-ticket-shadow)"
        >
          <rect
            x="0"
            y="0"
            width="100"
            height="56"
            rx="10"
            fill={`url(#zv-ticket-grad-${i})`}
            mask="url(#zv-ticket-mask)"
          />
        </g>
      ))}
    </svg>
  );
}
