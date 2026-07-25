import Link from "next/link";
import type { Metadata } from "next";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { OrganizerPost, PostComment, ReactionType } from "@/lib/types";
import ReactionButtons from "./reaction-buttons";
import CommentThread from "./comment-thread";
import VerifiedBadge from "@/components/verified-badge";

export const metadata: Metadata = {
  title: "Community",
  description:
    "Photos, updates and reactions from event organizers and the people who were there. Relive past nights and find your next one on Zivotix.",
  alternates: { canonical: "/community" },
};

// Single Instagram-style feed mixing every organizer's posts together, most
// recent first. Each post's organizer name/avatar sits up top like a
// username — click it to land on their profile (available tickets). The
// like/comment controls are always visible on every post; the actual
// ticket-holder gate is enforced server-side in the react/comment API
// routes, which the components below surface inline (a "get a ticket" nudge)
// if a click comes back unauthorized, rather than hiding the controls
// upfront.
type PostWithOrganizer = OrganizerPost & {
  organizers: { business_name: string; is_verified: boolean } | null;
};

export default async function CommunityPage() {
  const service = createServiceClient();
  const { data: posts } = await service
    .from("organizer_posts")
    .select("*, organizers(business_name, is_verified)")
    .order("created_at", { ascending: false })
    .limit(30)
    .returns<PostWithOrganizer[]>();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const postIds = (posts ?? []).map((p) => p.id);
  const { data: reactions } = postIds.length
    ? await service.from("post_reactions").select("post_id, profile_id, reaction").in("post_id", postIds)
    : { data: [] as { post_id: string; profile_id: string; reaction: ReactionType }[] };
  const { data: comments } = postIds.length
    ? await service.from("post_comments").select("*").in("post_id", postIds).returns<PostComment[]>()
    : { data: [] as PostComment[] };

  return (
    <main className="flex-1 mx-auto w-full max-w-2xl px-6 py-12 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Community</h1>
        <p className="text-sm text-neutral-500 mt-1">
          What&apos;s happening across every organizer on Zivotix. React and comment on any post.
          You&apos;ll need a ticket from that organizer to do it.
        </p>
      </div>

      {!posts || posts.length === 0 ? (
        <div className="zv-card p-10 text-center">
          <p className="text-sm text-neutral-400">No updates yet. Check back soon.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const postReactions = (reactions ?? []).filter((r) => r.post_id === post.id);
            const likes = postReactions.filter((r) => r.reaction === "like").length;
            const dislikes = postReactions.filter((r) => r.reaction === "dislike").length;
            const mine = postReactions.find((r) => r.profile_id === user?.id)?.reaction ?? null;
            const postComments = (comments ?? [])
              .filter((c) => c.post_id === post.id)
              .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
            const businessName = post.organizers?.business_name ?? "An organizer";

            return (
              <div key={post.id} className="zv-card p-5">
                <Link href={`/community/${post.organizer_id}`} className="flex items-center gap-2.5 mb-3 w-fit group">
                  <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center text-xs font-bold zv-gradient-text shrink-0">
                    {businessName.slice(0, 1).toUpperCase()}
                  </div>
                  <span className="text-sm font-semibold text-neutral-900 group-hover:underline flex items-center gap-1">
                    {businessName}
                    {post.organizers?.is_verified && <VerifiedBadge />}
                  </span>
                </Link>

                <p className="text-sm text-neutral-800 whitespace-pre-wrap">{post.body}</p>
                {post.image_urls.length > 0 && (
                  <div className={`mt-3 grid gap-1.5 ${post.image_urls.length === 1 ? "grid-cols-1" : "grid-cols-3"}`}>
                    {post.image_urls.map((url) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={url}
                        src={url}
                        alt=""
                        className={`w-full rounded-2xl object-cover ${
                          post.image_urls.length === 1 ? "aspect-[16/9]" : "aspect-square"
                        }`}
                      />
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs text-neutral-400">
                    {new Date(post.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                  <ReactionButtons
                    postId={post.id}
                    organizerId={post.organizer_id}
                    organizerName={businessName}
                    initialLikes={likes}
                    initialDislikes={dislikes}
                    initialMyReaction={mine}
                  />
                </div>

                <CommentThread
                  postId={post.id}
                  organizerId={post.organizer_id}
                  organizerName={businessName}
                  currentUserId={user?.id ?? null}
                  initialComments={postComments}
                />
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
