import Link from "next/link";
import Image from "next/image";
import type { EventRow } from "@/lib/types";
import { formatMoney } from "@/lib/currencies";

type EventWithPrices = EventRow & { ticket_types: { price: number }[] };

// Events drifting past in a single line, the way a marquee outside a venue
// does.
//
// A grid says "here is our catalogue". A moving line says "this is happening
// right now" — which is the more honest thing for a ticketing homepage to say,
// and it costs a fraction of the vertical space a grid does.
//
// Pure CSS: the track is rendered twice and translated by exactly -50%, so the
// moment the first copy scrolls out the second is pixel-aligned behind it and
// the loop is invisible. No JavaScript, no scroll listeners, one GPU transform.
export default function EventMarquee({ events }: { events: EventWithPrices[] }) {
  if (!events.length) return null;

  // A short list would leave a visible gap before the loop comes round, so it's
  // repeated until there's enough to fill a wide screen. With eight events this
  // is a no-op; with two it's what stops the row looking broken.
  const filled: EventWithPrices[] = [];
  while (filled.length < 8) filled.push(...events);

  // Constant speed regardless of how many cards there are: more cards, longer
  // track, proportionally longer duration.
  const seconds = filled.length * 6;

  return (
    <div
      className="zv-marquee -mx-6 px-6"
      style={{ "--zv-marquee-duration": `${seconds}s` } as React.CSSProperties}
    >
      <div className="zv-marquee-track flex gap-4 w-max">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex gap-4" aria-hidden={copy === 1}>
            {filled.map((event, i) => {
              const paid = (event.ticket_types ?? []).map((t) => t.price).filter((p) => p > 0);
              const from = paid.length ? Math.min(...paid) : null;
              const isFree = (event.ticket_types ?? []).length > 0 && paid.length === 0;
              return (
                <Link
                  key={`${copy}-${event.id}-${i}`}
                  href={`/events/${event.slug}`}
                  // Tabbable only in the real copy; the duplicate is scenery.
                  tabIndex={copy === 1 ? -1 : undefined}
                  className="zv-card zv-card-hover block w-[260px] shrink-0 overflow-hidden group"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-yellow-500/25 via-yellow-600/10 to-transparent">
                    {event.cover_image_url ? (
                      <Image
                        src={event.cover_image_url}
                        alt=""
                        fill
                        sizes="260px"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-3xl font-bold zv-gradient-text opacity-40">
                          {event.title.slice(0, 1)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-1">
                    <p className="zv-eyebrow zv-gradient-text">
                      {new Date(event.starts_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      · {event.city}
                    </p>
                    <h3 className="font-bold text-[0.95rem] leading-snug text-neutral-50 line-clamp-1">
                      {event.title}
                    </h3>
                    {isFree ? (
                      <p className="text-sm font-bold text-emerald-400">Free</p>
                    ) : (
                      from !== null && (
                        <p className="text-sm font-bold zv-gradient-text">
                          {formatMoney(from, event.currency)}
                        </p>
                      )
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
