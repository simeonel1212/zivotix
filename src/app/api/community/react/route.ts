import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { hasCommunityAccess } from "@/lib/community";

// Buyers never get direct write access to post_reactions via RLS (only the
// owning organizer/admin do — see supabase/schema.sql) — this route is the
// only path for a buyer to like/dislike a post, gated by the same
// hasCommunityAccess check used to render the feed itself.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { postId, reaction } = (await req.json()) as { postId: string; reaction: "like" | "dislike" | null };
  if (!postId) return NextResponse.json({ error: "postId is required" }, { status: 400 });
  if (reaction !== null && reaction !== "like" && reaction !== "dislike") {
    return NextResponse.json({ error: "Invalid reaction" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: post } = await service.from("organizer_posts").select("organizer_id").eq("id", postId).single();
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const allowed = await hasCommunityAccess(user.email, post.organizer_id);
  if (!allowed) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  if (reaction === null) {
    await service.from("post_reactions").delete().eq("post_id", postId).eq("profile_id", user.id);
  } else {
    await service
      .from("post_reactions")
      .upsert({ post_id: postId, profile_id: user.id, reaction }, { onConflict: "post_id,profile_id" });
  }

  return NextResponse.json({ ok: true });
}
