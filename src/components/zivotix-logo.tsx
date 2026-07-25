// Zivotix brand mark: a gold ticket glyph with punched notches and a bold Z,
// paired with a tight wordmark. One component everywhere so the brand stays
// consistent — header, footer, emails reference the same shapes.
export function ZivotixMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="zv-logo-gold" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fde047" />
          <stop offset="0.5" stopColor="#facc15" />
          <stop offset="1" stopColor="#ca8a04" />
        </linearGradient>
        <linearGradient id="zv-logo-sheen" x1="6" y1="4" x2="20" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <mask id="zv-logo-notches">
          <rect x="2" y="5" width="28" height="22" rx="5" fill="white" />
          <circle cx="2" cy="16" r="2.6" fill="black" />
          <circle cx="30" cy="16" r="2.6" fill="black" />
        </mask>
      </defs>

      {/* Ticket body */}
      <g transform="rotate(-6 16 16)">
        <rect x="2" y="5" width="28" height="22" rx="5" fill="url(#zv-logo-gold)" mask="url(#zv-logo-notches)" />
        <rect x="2" y="5" width="28" height="11" rx="5" fill="url(#zv-logo-sheen)" mask="url(#zv-logo-notches)" />
        {/* Z monogram */}
        <path
          d="M11 11.5h10l-10 9h10"
          stroke="white"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    </svg>
  );
}

export default function ZivotixLogo({
  markSize = 30,
  textClassName = "text-lg",
}: {
  markSize?: number;
  textClassName?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <ZivotixMark size={markSize} />
      <span className={`font-bold tracking-tight text-neutral-900 ${textClassName}`}>
        Zivo<span className="zv-gradient-text">tix</span>
      </span>
    </span>
  );
}
