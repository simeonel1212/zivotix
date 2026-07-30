import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { EventRow } from "@/lib/types";
import TicketBackdrop from "@/components/ticket-backdrop";
import { EVENT_CATEGORIES, categoryLabel, isValidCategory } from "@/lib/categories";
import { countryLabel } from "@/lib/countries";
import CountryFilter from "./country-filter";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Upcoming events",
  description:
    "Browse every event on sale right now: parties, concerts, festivals and more. Buy from anywhere in the world with card or Apple Pay. Instant QR tickets.",
  alternates: { canonical: "/events" },
};

type EventWithPrices = EventRow & { ticket_types: { price: number }[] };

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; country?: string }>;
}) {
  const { category, country } = await searchParams;
  const activeCategory = isValidCategory(category) ? category : null;

  const supabase = await createClient();
  const base = () =>
    supabase
      .from("events")
      .select("*, ticket_types(price)")
      .eq("status", "published")
      .eq("is_unlisted", false) // weddings/private events are link-only
      .order("starts_at", { ascending: true });

  // Countries are read from what's actually on sale, before the country filter
  // is applied — otherwise selecting one country would collapse the dropdown
  // to that single option and strand the visitor there.
  const { data: allEvents } = await base().returns<EventWithPrices[]>();
  const countries = [...new Set((allEvents ?? []).map((e) => e.country).filter(Boolean))].sort();
  // Narrowed back to OrgCountry after the membership check, so the Supabase
  // filter below stays type-safe rather than taking an arbitrary string.
  const activeCountry =
    country && countries.includes(country as (typeof countries)[number])
      ? (country as (typeof countries)[number])
      : null;

  let query = base();
  if (activeCategory) query = query.eq("category", activeCategory);
  if (activeCountry) query = query.eq("country", activeCountry);
  const { data: events } = await query.returns<EventWithPrices[]>();

  return (
    <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-16 relative">
      <div className="absolute inset-x-0 top-0 h-[420px] overflow-hidden pointer-events-none">
        <TicketBackdrop className="opacity-40" />
      </div>
      <div className="mb-8 relative z-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900">Upcoming events</h1>
          <p className="mt-2 text-neutral-500">
            {activeCountry
              ? `What's on in ${countryLabel(activeCountry)}.`
              : "Find something happening near you, or anywhere else."}
          </p>
        </div>
        <Suspense fallback={null}>
          <CountryFilter countries={countries} />
        </Suspense>
      </div>

      <div className="mb-10 flex flex-wrap gap-2 relative z-10">
        {/* Category links carry the country through, so switching category
            doesn't silently drop the country the visitor chose. */}
        <Link
          href={activeCountry ? `/events?country=${activeCountry}` : "/events"}
          className={`zv-badge transition-colors ${
            !activeCategory ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          }`}
        >
          All
        </Link>
        {EVENT_CATEGORIES.map((c) => (
          <Link
            key={c.value}
            href={`/events?category=${c.value}${activeCountry ? `&country=${activeCountry}` : ""}`}
            className={`zv-badge transition-colors ${
              activeCategory === c.value ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {c.label}
          </Link>
        ))}
      </div>

      {(!events || events.length === 0) && (
        <div className="zv-card p-16 text-center">
          <p className="text-neutral-400">
            {activeCountry
              ? `Nothing on sale in ${countryLabel(activeCountry)} right now.`
              : activeCategory
                ? "No events in this category yet."
                : "No events published yet. Check back soon."}
          </p>
          {(activeCountry || activeCategory) && (
            <Link href="/events" className="zv-btn-secondary mt-5 inline-flex text-sm">
              See everything
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {events?.map((event) => {
          const allPrices = event.ticket_types ?? [];
          const paidPrices = allPrices.map((tt) => tt.price).filter((p) => p > 0);
          const fromPrice = paidPrices.length ? Math.min(...paidPrices) : null;
          const isFree = allPrices.length > 0 && paidPrices.length === 0;
          return (
          <Link
            key={event.id}
            href={`/events/${event.slug}`}
            className="zv-card zv-card-hover block overflow-hidden group"
          >
            <div className="aspect-video bg-gradient-to-br from-yellow-100 via-yellow-50 to-white relative overflow-hidden">
              {event.cover_image_url ? (
                <Image
                  src={event.cover_image_url}
                  alt={event.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold zv-gradient-text opacity-40">{event.title.slice(0, 1)}</span>
                </div>
              )}
              <span className="absolute top-3 left-3 zv-badge bg-white/90 backdrop-blur-sm text-neutral-700 text-xs shadow-sm">
                {categoryLabel(event.category)}
              </span>
            </div>
            <div className="p-4 sm:p-5 flex items-start gap-3">
              {event.logo_image_url && (
                <Image
                  src={event.logo_image_url}
                  alt={`${event.title} logo`}
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-xl object-cover ring-1 ring-neutral-200/70 shadow-sm shrink-0"
                />
              )}
              <div className="space-y-1.5 min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide zv-gradient-text">
                  {new Date(event.starts_at).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  · {event.city}
                </p>
                <h2 className="font-semibold text-base sm:text-lg leading-snug text-neutral-900 line-clamp-2">{event.title}</h2>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-neutral-500 truncate">{event.venue}</p>
                  {isFree ? (
                    <p className="text-sm font-semibold text-emerald-600 whitespace-nowrap">Free</p>
                  ) : (
                    fromPrice !== null && (
                      // No approximate conversion on the browse grid: it was
                      // noise repeated down twenty cards, and reading the
                      // buyer's country needs request headers, which would opt
                      // this page out of its 60-second cache. The conversion
                      // now appears once, on the order total.
                      <p className="text-sm font-semibold text-neutral-900 whitespace-nowrap">
                        From {fromPrice.toLocaleString()} {event.currency}
                      </p>
                    )
                  )}
                </div>
              </div>
            </div>
          </Link>
          );
        })}
      </div>
    </main>
  );
}
