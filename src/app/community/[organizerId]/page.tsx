import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { hasCommunityAccess } from "@/lib/community";
import type { EventRow } from "@/lib/types";
import ResendLinkForm from "./resend-link-form";
import VerifiedBadge from "@/components/verified-badge";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ organizerId: string }>;
}): Promise<Metadata> {
  const { organizerId } = await params;
  const { data: organizer } = await createServiceClient()
    .from("organizers")
    .select("business_name")
    .eq("id", organizerId)
    .single();

  if (!organizer) return { title: "Organizer not found" };

  return {
    title: organizer.business_name,
    description: `Tickets and updates from ${organizer.business_name} on Zivotix.`,
    alternates: { canonical: `/community/${organizerId}` },
  };
}

// Organizer profile — what you land on from tapping a name in the community
// feed. Instagram-profile shaped: name up top, their available tickets below
// (the whole point of clicking through), and — for anyone who already has a
// ticket but isn't signed in yet — a way to unlock reacting/commenting back
// in the feed.
type EventWithPrices = EventRow & { ticket_types: { price: number }[] };

export default async function OrganizerProfilePage({ params }: { params: Promise<{ organizerId: string }> }) {
  const { organizerId } = await params;

  const service = createServiceClient();
  const { data: organizer } = await service
    .from("organizers")
    .select("business_name, is_verified")
    .eq("id", organizerId)
    .single();
  if (!organizer) notFound();

  const { data: events } = await service
    .from("events")
    .select("*, ticket_types(price)")
    .eq("organizer_id", organizerId)
    .eq("status", "published")
    .eq("is_unlisted", false) // weddings/private events are link-only
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .returns<EventWithPrices[]>();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const allowed = user?.email ? await hasCommunityAccess(user.email, organizerId) : false;

  return (
    <main className="flex-1 mx-auto w-full max-w-2xl px-6 py-12 space-y-8">
      <div>
        <Link href="/community" className="text-sm zv-gradient-text font-medium">
          ← Community
        </Link>
        <div className="flex items-center gap-4 mt-3">
          <div className="h-16 w-16 rounded-full bg-yellow-100 flex items-center justify-center text-2xl font-bold zv-gradient-text shrink-0">
            {organizer.business_name.slice(0, 1).toUpperCase()}
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            {organizer.business_name}
            {organizer.is_verified && <VerifiedBadge />}
          </h1>
        </div>
      </div>

      <div>
        <h2 className="font-semibold text-neutral-900 mb-3">Available tickets</h2>
        {!events || events.length === 0 ? (
          <div className="zv-card p-10 text-center">
            <p className="text-sm text-neutral-400">Nothing on sale right now. Check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {events.map((event) => {
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
                        sizes="(max-width: 640px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold zv-gradient-text opacity-40">
                          {event.title.slice(0, 1)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide zv-gradient-text">
                      {new Date(event.starts_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </p>
                    <h3 className="font-semibold text-sm text-neutral-900 line-clamp-2">{event.title}</h3>
                    {isFree ? (
                      <p className="text-xs font-semibold text-emerald-600">Free</p>
                    ) : (
                      fromPrice !== null && (
                        <p className="text-xs font-semibold text-neutral-900">
                          From {fromPrice.toLocaleString()} {event.currency}
                        </p>
                      )
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {!allowed && (
        <div className="zv-card p-6 space-y-3">
          <p className="text-sm text-neutral-600">
            {user
              ? `You're signed in as ${user.email}, but we don't see a ticket from ${organizer.business_name} on this email.`
              : `Got a ticket from ${organizer.business_name}? Sign in to react and comment on their posts in the community feed.`}
          </p>
          <ResendLinkForm organizerId={organizerId} />
        </div>
      )}
    </main>
  );
}
