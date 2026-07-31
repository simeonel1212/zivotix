// A ticket with actual depth, turning slowly in space.
//
// Built out of six positioned faces rather than a flat image with a drop
// shadow: the edges genuinely exist, so as it rotates you see the thickness
// and the light changes across the faces. That's the difference between
// something drawn to look 3D and something that is.
//
// No JavaScript at all — one CSS animation on the GPU. Purely decorative, so
// it's hidden from screen readers and never intercepts a click.
export default function Ticket3D({
  size = 180,
  className = "",
}: {
  /** Width in px; the ticket keeps a 5:3 card ratio. */
  size?: number;
  className?: string;
}) {
  const w = size;
  const h = Math.round(size * 0.6);
  const depth = 10;

  return (
    <div
      aria-hidden
      className={`zv-ticket3d pointer-events-none select-none ${className}`}
      style={{ width: w, height: h }}
    >
      <div className="zv-ticket3d-body" style={{ width: w, height: h }}>
        {/* Front and back, pushed apart to give the card its thickness. */}
        <div className="zv-ticket3d-face" style={{ transform: `translateZ(${depth / 2}px)` }}>
          <div className="flex h-full items-center justify-center">
            <span className="text-white/95 font-extrabold tracking-tight" style={{ fontSize: h * 0.2 }}>
              ZIVOTIX
            </span>
          </div>
          {/* The perforation, which is what makes the shape read as a ticket
              and not a credit card. */}
          <span
            className="absolute top-0 bottom-0 border-l-2 border-dashed border-white/45"
            style={{ left: "72%" }}
          />
        </div>

        <div
          className="zv-ticket3d-face"
          style={{ transform: `translateZ(-${depth / 2}px) rotateY(180deg)` }}
        />

        {/* Edges: two vertical, two horizontal, each rotated into place and
            pushed out to half the card's width or height. */}
        <div
          className="zv-ticket3d-edge"
          style={{ width: depth, left: -depth / 2, transform: `rotateY(90deg) translateZ(${w / 2}px)` }}
        />
        <div
          className="zv-ticket3d-edge"
          style={{
            width: depth,
            left: w - depth / 2,
            transform: `rotateY(90deg) translateZ(${w / 2 - w + depth}px)`,
          }}
        />
        <div
          className="zv-ticket3d-edge"
          style={{ height: depth, top: -depth / 2, transform: `rotateX(90deg) translateZ(${h / 2}px)` }}
        />
        <div
          className="zv-ticket3d-edge"
          style={{
            height: depth,
            top: h - depth / 2,
            transform: `rotateX(90deg) translateZ(-${h / 2}px)`,
          }}
        />
      </div>
    </div>
  );
}
