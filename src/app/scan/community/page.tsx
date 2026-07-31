import { redirect } from "next/navigation";
import Link from "next/link";
import type { OrganizerPost, PostComment, ReactionType } from "@/lib/types";
import { getCurrentOrganizer } from "@/lib/organizer";
import { ZivotixMark } from "@/components/zivotix-logo";
import ScannerTabs from "@/components/scanner-tabs";
import ScannerAccount from "@/components/scanner-account";
import PostForm from "@/app/organizer/community/post-form";
import DeletePostButton from "@/app/organizer/community/delete-post-button";

// Community, inside the installed app.
//
// Reuses PostForm and DeletePostButton from the organizer dashboard rather
// than reimplementing them: posting is the same operation, and a second copy
// would drift — the AI polish button, image upload and RLS-backed insert all
// have to behave identically whether an organizer posts from their laptop or
// from their phone between scanning guests in.
//
// Deliberately light-themed, unlike the camera screens. This is reading and
// writing, not scanning in a dark venue, and it should feel like the rest of
// Zivotix.
export default async function ScanCommunityPage() {
  const { supabase, user, organizer } = await getCurrentOrganizer("/scan/community");
  const email = user?.email ?? "";

  // Door staff can reach this URL but have nothing to post. Send them back to
  // the scanner rather than showing an empty dashboard they can't use.
  if (!organizer) redirect("/scan");

  const { data: posts } = await supabase
    .from("organizer_posts")
    .select("*, post_reactions(reaction), post_comments(*)")
    .eq("organizer_id", organizer.id)
    .order("created_at", { ascending: false })
    .returns<
      (OrganizerPost & { post_reactions: { reaction: ReactionType }[]; post_comments: PostComment[] })[]
    >();

  return (
    <div className="flex-1 flex flex-col bg-white/[0.04]">
      <header className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 bg-neutral-900 border-b border-white/15">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <ZivotixMark size={24} />
            <span className="font-bold tracking-tight text-neutral-50 text-sm">
              Zivo<span className="zv-gradient-text">tix</span>
            </span>
          </span>
          <ScannerAccount
            name={organizer.business_name ?? "Organizer"}
            email={email}
            role="Organizer"
            tone="light"
          />
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-neutral-50">Community</h1>
        <p className="mt-1 text-sm text-neutral-400 leading-relaxed">
          Post an update for everyone holding a ticket from you. It shows on your community page and
          the Zivotix homepage.
        </p>
      </header>

      <div className="flex-1 px-5 py-5 space-y-6">
        <div className="zv-card p-5">
          <PostForm organizerId={organizer.id} />
        </div>

        <div>
          <h2 className="font-semibold text-neutral-50 mb-3 text-sm">Your updates</h2>

          {!posts?.length ? (
            <div className="zv-card p-8 text-center">
              <p className="text-sm text-neutral-500">Nothing posted yet.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {posts.map((post) => (
                <li key={post.id} className="zv-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs text-neutral-500">
                      {new Date(post.created_at).toLocaleString(undefined, {
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                    <DeletePostButton postId={post.id} />
                  </div>

                  <p className="mt-2 text-sm text-neutral-200 whitespace-pre-wrap leading-relaxed">
                    {post.body}
                  </p>

                  {post.image_urls?.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-1.5">
                      {post.image_urls.slice(0, 6).map((url) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={url}
                          src={url}
                          alt=""
                          className="aspect-square w-full rounded-xl object-cover"
                        />
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex gap-4 text-xs text-neutral-500">
                    <span>{post.post_reactions?.length ?? 0} reactions</span>
                    <span>{post.post_comments?.length ?? 0} comments</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-center text-xs text-neutral-500">
          Replying to comments and the full feed live on{" "}
          <Link href="/organizer/community" className="font-semibold zv-gradient-text">
            the dashboard
          </Link>
          .
        </p>
      </div>

      <ScannerTabs showCommunity />
    </div>
  );
}
