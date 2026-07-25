import type { OrganizerPost, PostComment, ReactionType } from "@/lib/types";
import { getCurrentOrganizer } from "@/lib/organizer";
import NoOrganizerNotice from "@/components/no-organizer-notice";
import PostForm from "./post-form";
import DeletePostButton from "./delete-post-button";
import DeleteCommentButton from "./delete-comment-button";

export default async function OrganizerCommunityPage() {
  const { supabase, organizer } = await getCurrentOrganizer("/organizer/community");

  // Bail out before touching the database. Falling through with an empty
  // string here is what produced "invalid input syntax for type uuid".
  if (!organizer) return <NoOrganizerNotice title="Community" />;

  const { data: posts } = await supabase
    .from("organizer_posts")
    .select("*, post_reactions(reaction), post_comments(*)")
    .eq("organizer_id", organizer.id)
    .order("created_at", { ascending: false })
    .returns<
      (OrganizerPost & { post_reactions: { reaction: ReactionType }[]; post_comments: PostComment[] })[]
    >();

  return (
    <div className="max-w-2xl mx-auto space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Community</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Your posts are public, shown on your community page and the Zivotix homepage. Reacting and
          commenting stay limited to people who&apos;ve gotten a ticket from you (paid or free).
        </p>
      </div>

      <PostForm organizerId={organizer.id} />

      <div>
        <h2 className="font-semibold text-neutral-900 mb-3">Your updates</h2>
        {!posts || posts.length === 0 ? (
          <div className="zv-card p-10 text-center">
            <p className="text-sm text-neutral-400">No updates posted yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => {
              const likes = post.post_reactions.filter((r) => r.reaction === "like").length;
              const dislikes = post.post_reactions.filter((r) => r.reaction === "dislike").length;
              const comments = post.post_comments
                .slice()
                .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
              return (
                <div key={post.id} className="zv-card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm text-neutral-800 whitespace-pre-wrap flex-1">{post.body}</p>
                    <DeletePostButton postId={post.id} />
                  </div>
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
                  <div className="flex items-center gap-4 mt-4 text-xs text-neutral-400">
                    <span>{new Date(post.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
                    <span>👍 {likes}</span>
                    <span>👎 {dislikes}</span>
                    <span>💬 {comments.length}</span>
                  </div>

                  {comments.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-neutral-100 space-y-2.5">
                      {comments.map((c) => (
                        <div key={c.id} className="flex items-start justify-between gap-3 text-sm">
                          <div className="min-w-0">
                            <p className="text-neutral-700">{c.body}</p>
                            <p className="text-xs text-neutral-400 mt-0.5">
                              Ticket holder ·{" "}
                              {new Date(c.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                            </p>
                          </div>
                          <DeleteCommentButton commentId={c.id} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
