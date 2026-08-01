import Link from "next/link";
import Image from "next/image";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { EventRow, OrganizerPost, ReactionType } from "@/lib/types";
import ScrollReveal from "@/components/scroll-reveal";
import VerifiedBadge from "@/components/verified-badge";
import BuiltFor from "@/components/built-for";
import FeeComparison from "@/components/fee-comparison";
import Ticket3D from "@/components/ticket-3d";
import EventMarquee from "@/components/event-marquee";

export const revalidate = 60;

type EventWithPrices = EventRow & { ticket_types: { price: number }[] };
type PostWithOrganizer = OrganizerPost & {
  organizers: { business_name: string; is_verified: boolean } | null;
  post_reactions: { reaction: ReactionType }[];
  post_comments: { id: string }[];
};

// Landing page: a slim hero with the value prop spelled out, a trust strip,
// the community feed as social proof (the pitch — see real reactions from
// real ticket holders before you commit), a quick "why Zivotix" rundown,
// then the events themselves on sale.
export default async function HomePage() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("*, ticket_types(price)")
    .eq("status", "published")
    .eq("is_unlisted", false) // weddings/private events are link-only
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(12)
    .returns<EventWithPrices[]>();

  // Public posts — organizer_posts has no public RLS-read policy (only the
  // owner/admin can read it directly), so a service-role client is used here
  // deliberately, same as the dedicated /community pages. Reaction/comment
  // counts and is_verified come along for the ride so this section can lead
  // with real engagement and real trust signals, not just text.
  const service = createServiceClient();
  const { data: recentPosts } = await service
    .from("organizer_posts")
    .select("*, organizers(business_name, is_verified), post_reactions(reaction), post_comments(id)")
    .order("created_at", { ascending: false })
    .limit(3)
    .returns<PostWithOrganizer[]>();

  // Party crowd photo (Unsplash license — free to use) as the hero backdrop,
  // dimmed under a dark overlay so the copy stays legible. Plain crowd of
  // people dancing, no confetti/streamers in the air.
  const heroImage =
    "https://images.unsplash.com/photo-1504609813442-a8924e83f76e?auto=format&fit=crop&w=1600&q=80";

  return (
    <main className="flex-1">
      {/* ---------- Boxed photo hero ---------- */}
      <section className="mx-auto max-w-6xl px-6 pt-8">
        <div className="relative overflow-hidden rounded-[2rem] bg-black text-white px-6 py-20 sm:px-16 sm:py-24 text-center shadow-[0_32px_80px_-24px_rgba(0,0,0,0.5)]">
          {/* Party photo backdrop, dimmed for legibility */}
          <Image
            src={heroImage}
            alt=""
            aria-hidden="true"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/60 to-black/75" />

          {/* Real 3D tickets turning in the corners of the hero. Hidden on
              phones: at that width they'd land on top of the headline, and a
              decoration that fights the sentence it's decorating is just
              noise. */}
          <div className="absolute inset-0 hidden lg:block" aria-hidden>
            <div className="absolute left-10 top-16 opacity-70 [animation:zv-float_7s_ease-in-out_infinite]">
              <Ticket3D size={150} />
            </div>
            <div
              className="absolute right-12 bottom-16 opacity-60 [animation:zv-float_9s_ease-in-out_infinite]"
              style={{ animationDelay: "-3s" }}
            >
              <Ticket3D size={115} />
            </div>
          </div>

          <div className="relative z-10 mx-auto max-w-2xl">
            <h1 className="zv-display">
              Where <span className="zv-gradient-text">unforgettable events</span> come to life.
            </h1>
            <p className="mt-6 mx-auto max-w-lg text-lg text-neutral-200 leading-relaxed">
              Zivotix helps organizers create, promote, and sell tickets, while giving you a seamless
              way to discover experiences worth showing up for.
            </p>
            <div className="mt-9 flex flex-col items-center gap-3">
              <Link href="/organise" className="zv-btn-primary w-60 justify-center">
                Organise an Event
              </Link>
              <Link
                href="/events"
                className="inline-flex items-center justify-center gap-2 w-60 rounded-full border border-white/40 bg-transparent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-900/10"
              >
                Find Events
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Trust strip ---------- */}
      <section className="mx-auto max-w-6xl px-6 pt-10">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs sm:text-sm text-neutral-400">
          <span className="flex items-center gap-1.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 018 0v3" strokeLinecap="round" />
            </svg>
            Secured by Flutterwave
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Instant QR delivery
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3c2.5 2.6 3.8 5.8 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.8-3.8-9s1.3-6.4 3.8-9z" />
            </svg>
            Buy from anywhere in the world
          </span>
        </div>
      </section>

            {/* ---------- Tickets, straight after the hero ----------
          A marketplace that makes you scroll past three pitch sections to
          reach its inventory is asking a visitor to take its word for it. */}
      <ScrollReveal className="mx-auto max-w-6xl px-6 pt-14 block">
        <h2 className="zv-h2 text-neutral-50 mb-6">Tickets on sale now</h2>
        {(!events || events.length === 0) ? (
          <div className="zv-card p-16 text-center">
            <p className="text-neutral-500">No events on sale right now. Check back soon.</p>
          </div>
        ) : (
          <>
            {/* A moving line rather than a grid. A grid says "here is our
                catalogue"; a line drifting past says "this is happening now",
                which is the more honest thing for a ticketing homepage to
                claim — and it costs a third of the vertical space. */}
            <EventMarquee events={events} />
            <div className="mt-6">
              <Link href="/events" className="zv-btn-secondary text-sm">
                See all events
              </Link>
            </div>
          </>
        )}
      </ScrollReveal>

      {/* ---------- Community ----------
          After the tickets, not before. Someone who has just seen eight real
          events is ready to hear that there's a room behind them; someone who
          landed thirty seconds ago is not. */}
      {recentPosts && recentPosts.length > 0 && (
        <ScrollReveal className="mx-auto max-w-6xl px-6 pt-16 block">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4 mb-5">
            <div>
              <h2 className="zv-h2 text-neutral-50">
                Don&apos;t just buy tickets, be part of the community
              </h2>
              <p className="text-sm text-neutral-400 mt-1">
                Relive the memories, react to what&apos;s next, and connect with people who were there.
              </p>
            </div>
            {/* A full button, not the text link this used to be. It's the one
                place on the homepage asking for something other than a
                purchase, and a 14px gradient link next to a section heading
                loses that argument every time. */}
            <Link
              href="/community"
              className="zv-btn-primary shrink-0 w-full sm:w-auto justify-center text-base px-8 py-4"
            >
              Join the community
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {recentPosts.map((post) => {
              const likes = post.post_reactions.filter((r) => r.reaction === "like").length;
              const commentCount = post.post_comments.length;
              const businessName = post.organizers?.business_name ?? "An organizer";
              return (
                <div key={post.id} className="zv-card zv-card-hover p-5 flex flex-col">
                  <Link
                    href={`/community/${post.organizer_id}`}
                    className="text-xs font-semibold uppercase tracking-wide zv-gradient-text hover:underline w-fit flex items-center gap-1"
                  >
                    {businessName}
                    {post.organizers?.is_verified && <VerifiedBadge />}
                  </Link>
                  <p className="text-sm text-neutral-100 whitespace-pre-wrap mt-1.5 line-clamp-3">{post.body}</p>
                  {post.image_urls.length > 0 && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.image_urls[0]} alt="" className="mt-3 w-full rounded-2xl object-cover aspect-[16/9]" />
                  )}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
                    <span className="text-xs text-neutral-500">
                      👍 {likes} · 💬 {commentCount}
                    </span>
                    <Link href={`/community/${post.organizer_id}`} className="text-xs font-semibold zv-gradient-text">
                      Get tickets →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollReveal>
      )}

      {/* ---------- The pitch to organizers ----------
          Last. Everything above it is evidence: real events on sale, a real
          community reacting to them. The argument for hosting lands harder
          after the proof than before it. */}
      <ScrollReveal className="mx-auto max-w-6xl px-6 pt-16 space-y-6">
        <BuiltFor />
        <FeeComparison />
      </ScrollReveal>

    </main>
  );
}