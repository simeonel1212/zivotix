import type { Metadata } from "next";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { OrganizerPost, PostComment, ReactionType } from "@/lib/types";
import PostCard from "@/components/post-card";

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
  organizers: { business_name: string; is_verified: boolean; handle: string | null } | null;
};

export default async function CommunityPage() {
  const service = createServiceClient();
  const { data: posts } = await service
    .from("organizer_posts")
    .select("*, organizers(business_name, is_verified, handle)")
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
        <h1 className="zv-h1 text-neutral-900">Community</h1>
        <p className="zv-lead mt-3">
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
              <PostCard
                key={post.id}
                post={post}
                organizerName={businessName}
                organizerVerified={post.organizers?.is_verified ?? false}
                organizerHref={
                  post.organizers?.handle
                    ? `/${post.organizers.handle}`
                    : `/community/${post.organizer_id}`
                }
                likes={likes}
                dislikes={dislikes}
                myReaction={mine}
                comments={postComments}
                currentUserId={user?.id ?? null}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}
