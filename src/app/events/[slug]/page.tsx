import { notFound } from "next/navigation";
import Image from "next/image";
import type { Metadata } from "next";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { EventRow, TicketType } from "@/lib/types";
import { googleMapsUrl, googleMapsEmbedUrl } from "@/lib/maps";
import { appUrl } from "@/lib/app-url";
import TicketSelector from "./ticket-selector";

// Per-event metadata is the single biggest SEO lever here: it's what makes
// an individual event page rank for its own name, and what makes a shared
// link unfurl with the event's cover art instead of a bare URL.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const service = createServiceClient();
  const { data: event } = await service
    .from("events")
    .select("title, description, venue, city, country, starts_at, cover_image_url")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!event) return { title: "Event not found" };

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
    organizer: { "@type": "Organization", name: "Zivotix", url: appUrl() },
    url: `${appUrl()}/events/${event.slug}`,
  };

  return (
    <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-12 space-y-10">
      <script
        type="application/ld+json"
        // Next.js requires this form for JSON-LD; the payload is our own
        // server-built object, not user-controlled HTML.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="relative aspect-[21/9] rounded-3xl bg-gradient-to-br from-yellow-100 via-yellow-50 to-white overflow-hidden shadow-[0_20px_60px_-20px_rgba(0,0,0,0.15)]">
        {event.cover_image_url && (
          <Image
            src={event.cover_image_url}
            alt={event.title}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
          />
        )}
      </div>

      <div className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900">{event.title}</h1>
        <div className="space-y-2.5">
          <div className="flex items-center gap-3 text-neutral-600">
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
          <div className="flex items-center gap-3 text-neutral-600">
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
            <p className="text-neutral-700 leading-relaxed whitespace-pre-line">{event.description}</p>
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
          <div className="rounded-3xl overflow-hidden border border-neutral-200/70 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.12)]">
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

      <TicketSelector event={event} ticketTypes={ticketTypes ?? []} />

      {event.logo_image_url && (
        <div className="flex justify-center pt-4">
          <Image
            src={event.logo_image_url}
            alt={`${event.title} logo`}
            width={112}
            height={112}
            className="h-28 w-28 rounded-3xl object-cover ring-1 ring-neutral-200/70 shadow-[0_12px_30px_-10px_rgba(0,0,0,0.2)]"
          />
        </div>
      )}
    </main>
  );
}
