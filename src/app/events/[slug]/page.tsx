import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { EventRow, TicketType, MembershipTier, MerchProduct } from "@/lib/types";
import { googleMapsUrl, googleMapsEmbedUrl } from "@/lib/maps";
import { resolvePaymentRoute } from "@/lib/payment-router";
import { appUrl } from "@/lib/app-url";
import VerifiedBadge from "@/components/verified-badge";
import ShareButton from "@/components/share-button";
import MembershipUpsell from "@/components/membership-upsell";
import MerchStrip from "@/components/merch-strip";
import ExpandableText from "@/components/expandable-text";
import StickyBuyBar from "./sticky-buy-bar";
import TicketSelector from "./ticket-selector";

// Per-event metadata is the single biggest SEO lever here: it's what makes
// an individual event page rank for its own name, and what makes a shared
// link unfurl with the event's cover art instead of a bare URL.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const service = createServiceClient();
  const { data: event } = await service
    .from("events")
    .select("title, description, venue, city, country, starts_at, cover_image_url, is_unlisted")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!event) return { title: "Event not found" };

  // Unlisted events (weddings, private parties) are link-only: keep them out
  // of search results entirely, and don't let a crawler generate a preview.
  const privacy: Metadata = event.is_unlisted
    ? { robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } } }
    : {};

  const dateLabel = new Date(event.starts_at).toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const place = [event.venue, event.city].filter(Boolean).join(", ");
  const description =
    event.description?.slice(0, 155) ??
    `${event.title} at ${place} on ${dateLabel}. Get your tickets on Zivotix.`;

  return {
    title: `${event.title} — ${place}`,
    description,
    alternates: { canonical: `/events/${slug}` },
    openGraph: {
      type: "website",
      title: `${event.title} — ${place}`,
      description,
      url: `${appUrl()}/events/${slug}`,
      images: event.cover_image_url ? [{ url: event.cover_image_url, alt: event.title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${event.title} — ${place}`,
      description,
      images: event.cover_image_url ? [event.cover_image_url] : undefined,
    },
    ...privacy,
  };
}

export default async function EventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single<EventRow>();

  if (!event) notFound();

  const { data: ticketTypes } = await supabase
    .from("ticket_types")
    .select("*")
    .eq("event_id", event.id)
    .order("price", { ascending: true })
    .returns<TicketType[]>();

  // Who is actually running this event, shown above the title so a buyer
  // knows who they're paying before they read anything else. Read with the
  // service role because organizers has no public-select policy.
  const { data: organizer } = await createServiceClient()
    .from("organizers")
    .select("id, business_name, is_verified, handle")
    .eq("id", event.organizer_id)
    .maybeSingle();

  // Prefer the vanity link when they've claimed one — it's the same page, but
  // it's the link they'd want a buyer to see and remember.
  const organizerHref = organizer?.handle
    ? `/${organizer.handle}`
    : `/community/${event.organizer_id}`;

  // Passes this organizer has on sale, shown beneath the ticket selector.
  const { data: membershipTiers } = await createServiceClient()
    .from("membership_tiers")
    .select("*")
    .eq("organizer_id", event.organizer_id)
    .eq("is_active", true)
    .order("price", { ascending: true })
    .returns<MembershipTier[]>();

  // Merch this organizer sells, shown under the ticket selector for the same
  // reason the pass upsell is there: buyers arrive from a shared event link and
  // never see the profile.
  const { data: merch } = await createServiceClient()
    .from("merch_products")
    .select("*")
    .eq("organizer_id", event.organizer_id)
    .eq("is_active", true)
    .order("price", { ascending: true })
    .returns<MerchProduct[]>();

  const paidPrices = (ticketTypes ?? []).map((tt) => tt.price).filter((p) => p > 0);

  // The frame hugs the flyer rather than the flyer being cropped to the frame.
  // Clamped at both ends so a freak upload — a 1px-tall strip, a 4000px-tall
  // menu photo — can't produce a hero that fills three screens or vanishes.
  // 4:5 when unknown, which is the shape most event flyers actually are.
  const coverAspect = Math.min(1.91, Math.max(0.7, event.cover_aspect ?? 0.8));

  const mapsUrl = googleMapsUrl(event.venue, event.city, event.country);
  const mapsEmbedUrl = googleMapsEmbedUrl(event.venue, event.city, event.country);

  // schema.org Event markup — this is what qualifies the page for Google's
  // event rich results (the date/venue/price card that shows directly in
  // search and in the Google "Events" tab).
  const offers = (ticketTypes ?? []).map((tt) => ({
    "@type": "Offer",
    name: tt.name,
    price: tt.price,
    priceCurrency: event.currency,
    availability:
      tt.quantity_sold >= tt.quantity_total
        ? "https://schema.org/SoldOut"
        : "https://schema.org/InStock",
    url: `${appUrl()}/events/${event.slug}`,
    validFrom: tt.sales_start ?? undefined,
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    startDate: event.starts_at,
    ...(event.ends_at ? { endDate: event.ends_at } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    ...(event.description ? { description: event.description } : {}),
    ...(event.cover_image_url ? { image: [event.cover_image_url] } : {}),
    location: {
      "@type": "Place",
      name: event.venue ?? event.city ?? "Venue",
      address: {
        "@type": "PostalAddress",
        ...(event.venue ? { streetAddress: event.venue } : {}),
        ...(event.city ? { addressLocality: event.city } : {}),
        addressCountry: event.country,
      },
    },
    ...(offers.length ? { offers } : {}),
    // The organizer in schema.org terms is whoever actually runs the event,
    // not the ticketing platform.
    organizer: organizer?.business_name
      ? {
          "@type": "Organization",
          name: organizer.business_name,
          url: `${appUrl()}/community/${organizer.id}`,
        }
      : { "@type": "Organization", name: "Zivotix", url: appUrl() },
    url: `${appUrl()}/events/${event.slug}`,
  };

  return (
    <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-12 pb-32 space-y-10">
      {/* Structured data exists to earn Google event rich results, so it's
          pointless (and counterproductive) on an unlisted private event. */}
      {!event.is_unlisted && (
        <script
          type="application/ld+json"
          // Next.js requires this form for JSON-LD; the payload is our own
          // server-built object, not user-controlled HTML.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {/* The flyer, whole.
          This was a 21:9 banner with object-cover, which is the wrong shape for
          the artwork organizers actually have: event flyers are portrait and
          they have type on them — the venue, the line-up, the door time. A wide
          crop cut all of that off, so organizers were designing a poster and
          watching the site throw two thirds of it away.
          Now the image is contained and never cropped, with a blurred copy of
          itself filling whatever space its aspect ratio leaves over. */}
      <div
        className="relative rounded-3xl bg-gradient-to-br from-yellow-500/25 via-yellow-600/10 to-transparent overflow-hidden shadow-[0_20px_60px_-20px_rgba(0,0,0,0.15)]"
        style={{ aspectRatio: String(coverAspect) }}
      >
        {event.cover_image_url && (
          <>
            <Image
              src={event.cover_image_url}
              alt=""
              aria-hidden
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover scale-110 blur-2xl brightness-75"
            />
            <Image
              src={event.cover_image_url}
              alt={event.title}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-contain"
            />
          </>
        )}
      </div>

      <div className="space-y-4">
        {organizer && (
          <Link
            href={organizerHref}
            className="inline-flex items-center gap-1.5 text-sm font-semibold zv-gradient-text hover:underline w-fit"
          >
            {organizer.business_name}
            {organizer.is_verified && <VerifiedBadge />}
          </Link>
        )}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="text-4xl font-bold tracking-tight text-neutral-50">{event.title}</h1>
          {/* Sits beside the title rather than down with the ticket selector:
              people share an event when they first recognise it, not after
              they've decided to buy. */}
          <ShareButton
            title={event.title}
            text={`${event.title} — ${new Date(event.starts_at).toLocaleDateString(undefined, {
              day: "numeric",
              month: "long",
            })} at ${event.venue}, ${event.city}. Tickets:`}
            className="shrink-0"
          />
        </div>
        <div className="space-y-2.5">
          <div className="flex items-center gap-3 text-neutral-300">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor" className="shrink-0" style={{ color: "var(--accent-solid)" }} aria-hidden="true">
              <rect x="3" y="5" width="18" height="16" rx="3" />
              <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
            </svg>
            <span className="text-sm font-medium">
              {new Date(event.starts_at).toLocaleString(undefined, {
                dateStyle: "full",
                timeStyle: "short",
              })}
            </span>
          </div>
          <div className="flex items-center gap-3 text-neutral-300">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor" className="shrink-0" style={{ color: "var(--accent-solid)" }} aria-hidden="true">
              <path d="M12 22s7-7.58 7-12.5A7 7 0 0 0 5 9.5C5 14.42 12 22 12 22Z" strokeLinejoin="round" />
              <circle cx="12" cy="9.5" r="2.4" />
            </svg>
            <span className="text-sm font-medium">
              {event.venue} · {event.city}, {event.country}
            </span>
          </div>
        </div>
      </div>

      {(event.description || (event.links ?? []).some((l) => /^https?:\/\//i.test(l.url))) && (
        <div className="zv-card p-6 sm:p-8 space-y-5">
          {event.description && (
            <ExpandableText
              text={event.description}
              lines={7}
              className="text-neutral-200 leading-relaxed"
            />
          )}

          {(event.links ?? []).filter((l) => /^https?:\/\//i.test(l.url)).length > 0 && (
            <div className="flex flex-wrap gap-3">
              {event.links
                .filter((l) => /^https?:\/\//i.test(l.url))
                .map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="zv-btn-secondary text-sm"
                  >
                    {link.label}
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                ))}
            </div>
          )}
        </div>
      )}

      {(event.gallery_image_urls ?? []).length > 0 && (
        <div className="space-y-6">
          {event.gallery_image_urls.map((url, i) => (
            <Image
              key={url}
              src={url}
              alt={`${event.title} photo ${i + 1}`}
              width={1600}
              height={1000}
              sizes="(max-width: 768px) 100vw, 768px"
              className="w-full h-auto rounded-3xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.15)]"
              loading="lazy"
            />
          ))}
        </div>
      )}

      {mapsEmbedUrl && (
        <div className="space-y-2">
          <div className="rounded-3xl overflow-hidden border border-white/15 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.12)]">
            <iframe
              src={mapsEmbedUrl}
              className="w-full h-64 sm:h-80"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title={`Map showing ${event.venue ?? event.title}`}
            />
          </div>
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-semibold zv-gradient-text"
            >
              Open in Google Maps ↗
            </a>
          )}
        </div>
      )}

      <div id="tickets" className="scroll-mt-6">
        <TicketSelector
          event={event}
          ticketTypes={ticketTypes ?? []}
          chargeCurrency={resolvePaymentRoute(event.currency).chargeCurrency}
        />
      </div>

      <StickyBuyBar
        fromPrice={paidPrices.length ? Math.min(...paidPrices) : null}
        currency={event.currency}
        isFree={(ticketTypes ?? []).length > 0 && paidPrices.length === 0}
        soldOut={
          (ticketTypes ?? []).length > 0 &&
          (ticketTypes ?? []).every((tt) => tt.quantity_sold >= tt.quantity_total)
        }
        targetId="tickets"
      />

      {/* Most buyers arrive here from a shared event link, never seeing the
          organizer's page — so without this, passes would go undiscovered by
          almost everyone. Placed below the ticket selector deliberately: the
          person came for this night, and the pass is the upsell after they've
          seen the price, not a distraction before it. */}
      <MerchStrip
        products={merch ?? []}
        organizerHref={organizerHref}
        organizerName={organizer?.business_name ?? null}
      />

      {event.members_included && (membershipTiers ?? []).length > 0 && (
        <MembershipUpsell
          tiers={membershipTiers ?? []}
          organizerHref={organizerHref}
          organizerName={organizer?.business_name ?? null}
          cheapestTicket={
            (ticketTypes ?? []).map((t) => t.price).filter((p) => p > 0).sort((a, b) => a - b)[0] ?? null
          }
        />
      )}

      {event.logo_image_url && (
        <div className="flex justify-center pt-4">
          <Image
            src={event.logo_image_url}
            alt={`${event.title} logo`}
            width={112}
            height={112}
            className="h-28 w-28 rounded-3xl object-cover ring-1 ring-white/15 shadow-[0_12px_30px_-10px_rgba(0,0,0,0.2)]"
          />
        </div>
      )}
    </main>
  );
}
