import Link from "next/link";
import type { OrganizerPost, PostComment, ReactionType } from "@/lib/types";
import ReactionButtons from "@/app/community/reaction-buttons";
import CommentThread from "@/app/community/comment-thread";
import VerifiedBadge from "@/components/verified-badge";

// One post, rendered identically in the main feed and on an organizer's
// profile. Shared rather than duplicated because the two views drifting apart
// is how a feed starts to feel broken — a like count that renders one way here
// and another way there reads as a bug even when both are correct.
//
// The only difference between the two placements is the byline: on a profile
// you already know whose posts these are, so repeating the name above every
// single one is noise.
export default function PostCard({
  post,
  organizerName,
  organizerVerified,
  organizerHref,
  showByline = true,
  likes,
  dislikes,
  myReaction,
  comments,
  currentUserId,
}: {
  post: OrganizerPost;
  organizerName: string;
  organizerVerified: boolean;
  organizerHref: string;
  /** False on an organizer's own profile, where the name is already the header. */
  showByline?: boolean;
  likes: number;
  dislikes: number;
  myReaction: ReactionType | null;
  comments: PostComment[];
  currentUserId: string | null;
}) {
  return (
    <div className="zv-card p-5">
      {showByline && (
        <Link href={organizerHref} className="flex items-center gap-2.5 mb-3 w-fit group">
          <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center text-xs font-bold zv-gradient-text shrink-0">
            {organizerName.slice(0, 1).toUpperCase()}
          </div>
          <span className="text-sm font-semibold text-neutral-900 group-hover:underline flex items-center gap-1">
            {organizerName}
            {organizerVerified && <VerifiedBadge />}
          </span>
        </Link>
      )}

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
          {new Date(post.created_at).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </span>
        <ReactionButtons
          postId={post.id}
          organizerId={post.organizer_id}
          organizerName={organizerName}
          initialLikes={likes}
          initialDislikes={dislikes}
          initialMyReaction={myReaction}
        />
      </div>

      <CommentThread
        postId={post.id}
        organizerId={post.organizer_id}
        organizerName={organizerName}
        currentUserId={currentUserId}
        initialComments={comments}
      />
    </div>
  );
}
