import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { hasCommunityAccess } from "@/lib/community";
import { chargeCurrencyMap } from "@/lib/payment-router";
import { buyerCountry } from "@/lib/geo";
import type {
  EventRow,
  MembershipTier,
  MerchProduct,
  OrganizerPost,
  PostComment,
  ReactionType,
} from "@/lib/types";
import ResendLinkForm from "./resend-link-form";
import VerifiedBadge from "@/components/verified-badge";
import MembershipTiers from "@/components/membership-tiers";
import PostCard from "@/components/post-card";
import MerchGrid from "@/components/merch-grid";
import { formatMoney } from "@/lib/currencies";

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
// feed. Instagram-profile shaped: name up top, then the pass (the thing worth
// the most to both sides), then a tab switch between what's on sale and what
// they've been posting.
//
// Tabs rather than a second page: someone who tapped a post wants more posts,
// but the tickets are why the platform exists, and burying them behind another
// tap costs sales. One tap from the feed reaches everything.
//
// The tab lives in the URL rather than in React state so that a link to
// someone's posts is shareable and the back button behaves.
type EventWithPrices = EventRow & { ticket_types: { price: number }[] };

export default async function OrganizerProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ organizerId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { organizerId } = await params;
  const { tab } = await searchParams;
  const showPosts = tab === "posts";
  const showMerch = tab === "merch";

  const service = createServiceClient();
  const { data: organizer } = await service
    .from("organizers")
    .select("business_name, is_verified, handle")
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

  const { data: tiers } = await service
    .from("membership_tiers")
    .select("*")
    .eq("organizer_id", organizerId)
    .eq("is_active", true)
    .order("price", { ascending: true })
    .returns<MembershipTier[]>();

  const { data: merch } = await service
    .from("merch_products")
    .select("*")
    .eq("organizer_id", organizerId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .returns<MerchProduct[]>();

  const { data: posts } = await service
    .from("organizer_posts")
    .select("*")
    .eq("organizer_id", organizerId)
    .order("created_at", { ascending: false })
    .limit(30)
    .returns<OrganizerPost[]>();

  // Reactions and comments are only rendered on the posts tab, so there's no
  // reason to pay for them when someone is looking at tickets.
  const postIds = showPosts ? (posts ?? []).map((p) => p.id) : [];
  const { data: reactions } = postIds.length
    ? await service
        .from("post_reactions")
        .select("post_id, profile_id, reaction")
        .in("post_id", postIds)
    : { data: [] as { post_id: string; profile_id: string; reaction: ReactionType }[] };
  const { data: comments } = postIds.length
    ? await service.from("post_comments").select("*").in("post_id", postIds).returns<PostComment[]>()
    : { data: [] as PostComment[] };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const allowed = user?.email ? await hasCommunityAccess(user.email, organizerId) : false;

  const base = organizer.handle ? `/${organizer.handle}` : `/community/${organizerId}`;
  const eventCount = events?.length ?? 0;
  const postCount = posts?.length ?? 0;
  const merchCount = merch?.length ?? 0;

  return (
    <main className="flex-1 mx-auto w-full max-w-2xl px-6 py-12 space-y-8">
      <div>
        <Link href="/community" className="text-sm zv-gradient-text font-medium">
          ← Community
        </Link>
        <div className="flex items-center gap-4 mt-3">
          <div className="h-16 w-16 rounded-full bg-yellow-500/15 flex items-center justify-center text-2xl font-bold zv-gradient-text shrink-0">
            {organizer.business_name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="zv-h1 text-neutral-50 flex items-center gap-2">
              {organizer.business_name}
              {organizer.is_verified && <VerifiedBadge />}
            </h1>
            {organizer.handle && (
              <p className="text-sm text-neutral-500 mt-0.5">zivotix.site/{organizer.handle}</p>
            )}
          </div>
        </div>
      </div>

      {/* Above the tabs on purpose: the pass is worth more than any single
          ticket, and it shouldn't be something you can tab away from. */}
      {/* Guarded rather than left to render nothing: an empty wrapper still
          counts as a child of space-y-8 and leaves a dead gap. */}
      {(tiers ?? []).length > 0 && (
        <div id="passes" className="scroll-mt-24">
          <MembershipTiers
            tiers={tiers ?? []}
            chargeCurrencies={chargeCurrencyMap(
              (tiers ?? []).map((t) => t.currency),
              await buyerCountry()
            )}
          />
        </div>
      )}

      <div className="flex items-center gap-1 border-b border-white/15">
        <Tab href={base} label="Tickets" count={eventCount} active={!showPosts && !showMerch} />
        <Tab href={`${base}?tab=posts`} label="Posts" count={postCount} active={showPosts} />
        {/* Only when there's something to sell — an empty Merch tab tells a
            visitor the organizer tried and gave up. */}
        {merchCount > 0 && (
          <Tab href={`${base}?tab=merch`} label="Merch" count={merchCount} active={showMerch} />
        )}
      </div>

      {showMerch ? (
        <MerchGrid
          products={merch ?? []}
          chargeCurrencies={chargeCurrencyMap(
            (merch ?? []).map((p) => p.currency),
            await buyerCountry()
          )}
        />
      ) : showPosts ? (
        !posts?.length ? (
          <div className="zv-card p-10 text-center">
            <p className="text-sm text-neutral-500">
              {organizer.business_name} hasn&apos;t posted yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => {
              const postReactions = (reactions ?? []).filter((r) => r.post_id === post.id);
              return (
                <PostCard
                  key={post.id}
                  post={post}
                  organizerName={organizer.business_name}
                  organizerVerified={organizer.is_verified}
                  organizerHref={base}
                  // The name is already the page header — repeating it above
                  // every post is noise.
                  showByline={false}
                  likes={postReactions.filter((r) => r.reaction === "like").length}
                  dislikes={postReactions.filter((r) => r.reaction === "dislike").length}
                  myReaction={
                    postReactions.find((r) => r.profile_id === user?.id)?.reaction ?? null
                  }
                  comments={(comments ?? [])
                    .filter((c) => c.post_id === post.id)
                    .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))}
                  currentUserId={user?.id ?? null}
                />
              );
            })}
          </div>
        )
      ) : !events || events.length === 0 ? (
        <div className="zv-card p-10 text-center">
          <p className="text-sm text-neutral-500">Nothing on sale right now. Check back soon.</p>
        </div>
      ) : (
        // A side-scrolling row rather than a grid: it keeps the page short so
        // the tabs and the pass stay in reach, and a row that runs off the edge
        // reads as "there's more" in a way a grid that simply ends does not.
        // Negative margins let the row bleed to the screen edge on mobile,
        // which is what makes the swipe feel native rather than boxed in.
        <div className="-mx-6 px-6 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-3 pb-2">
            {events.map((event) => {
              const allPrices = event.ticket_types ?? [];
              const paidPrices = allPrices.map((tt) => tt.price).filter((p) => p > 0);
              const fromPrice = paidPrices.length ? Math.min(...paidPrices) : null;
              const isFree = allPrices.length > 0 && paidPrices.length === 0;
              return (
                <Link
                  key={event.id}
                  href={`/events/${event.slug}`}
                  className="zv-card zv-card-hover block overflow-hidden group w-44 shrink-0 snap-start"
                >
                  <div className="aspect-[4/5] bg-gradient-to-br from-yellow-500/25 via-yellow-600/10 to-transparent relative overflow-hidden">
                    {event.cover_image_url ? (
                      <Image
                        src={event.cover_image_url}
                        alt={event.title}
                        fill
                        sizes="176px"
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
                      {new Date(event.starts_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    <h3 className="font-semibold text-sm text-neutral-50 line-clamp-2">
                      {event.title}
                    </h3>
                    {isFree ? (
                      <p className="text-xs font-semibold text-emerald-400">Free</p>
                    ) : (
                      fromPrice !== null && (
                        <p className="text-xs font-semibold text-neutral-50">
                          From {formatMoney(fromPrice, event.currency)}
                        </p>
                      )
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {!allowed && (
        <div className="zv-card p-6 space-y-3">
          <p className="text-sm text-neutral-300">
            {user
              ? `You're signed in as ${user.email}, but we don't see a ticket from ${organizer.business_name} on this email.`
              : `Got a ticket from ${organizer.business_name}? Sign in to react and comment on their posts.`}
          </p>
          <ResendLinkForm organizerId={organizerId} />
        </div>
      )}
    </main>
  );
}

function Tab({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
        active
          ? "border-neutral-900 text-neutral-50"
          : "border-transparent text-neutral-500 hover:text-neutral-200"
      }`}
    >
      {label}
      {count > 0 && <span className="ml-1.5 text-xs font-medium text-neutral-500">{count}</span>}
    </Link>
  );
}
