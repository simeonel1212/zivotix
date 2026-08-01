import Link from "next/link";
import Image from "next/image";
import { formatMoney } from "@/lib/currencies";
import type { MerchProduct } from "@/lib/types";

// Merch, on the event page.
//
// Built for exactly the reason memberships needed the same treatment: almost
// every buyer arrives from a shared event link and never visits the organizer's
// profile, so anything that only lives there is effectively invisible. Someone
// who has just bought a ticket to the night is also the single most likely
// person to buy the shirt.
//
// Photos only, no buy form. This sits under a checkout the visitor came here
// to complete, and a second purchase flow competing with it would cost more
// ticket sales than it gains shirt sales.
export default function MerchStrip({
  products,
  organizerHref,
  organizerName,
}: {
  products: MerchProduct[];
  organizerHref: string;
  organizerName: string | null;
}) {
  if (!products.length) return null;

  const cheapest = products.reduce((a, b) => (a.price <= b.price ? a : b));

  return (
    <section className="zv-card p-6 sm:p-7">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="min-w-0">
          <p className="zv-eyebrow zv-gradient-text">Merch</p>
          <h2 className="mt-1 text-lg font-bold text-neutral-50">
            From {formatMoney(cheapest.price, cheapest.currency)}
          </h2>
        </div>
        <Link href={`${organizerHref}?tab=merch`} className="zv-btn-secondary text-sm shrink-0">
          Shop
        </Link>
      </div>

      {/* A row rather than a grid: three shirts shouldn't take the vertical
          space three event cards would. */}
      <div className="-mx-6 px-6 sm:mx-0 sm:px-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-3 min-w-max">
          {products.slice(0, 6).map((p) => (
            <Link
              key={p.id}
              href={`${organizerHref}?tab=merch`}
              className="w-32 shrink-0 group"
              aria-label={`${p.name}, ${formatMoney(p.price, p.currency)}`}
            >
              <div className="relative aspect-square overflow-hidden rounded-2xl bg-white/[0.04]">
                {p.image_urls[0] && (
                  <Image
                    src={p.image_urls[0]}
                    alt=""
                    fill
                    sizes="128px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}
              </div>
              <p className="mt-2 text-xs font-medium text-neutral-200 line-clamp-1">{p.name}</p>
              <p className="text-xs font-bold zv-gradient-text">
                {formatMoney(p.price, p.currency)}
              </p>
            </Link>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs text-neutral-500">
        By {organizerName ?? "this organizer"} · collect at the event or get it delivered
      </p>
    </section>
  );
}
