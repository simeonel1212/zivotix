import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { hasCommunityAccess } from "@/lib/community";

// Buyers never get direct write access to post_comments via RLS (only the
// owning organizer/admin do — see supabase/schema.sql) — this route is the
// only path for a buyer to comment, gated by the same hasCommunityAccess
// check used to render the feed itself.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { postId, body } = (await req.json()) as { postId?: string; body?: string };
  const trimmed = body?.trim() ?? "";
  if (!postId) return NextResponse.json({ error: "postId is required" }, { status: 400 });
  if (!trimmed) return NextResponse.json({ error: "Comment can't be empty" }, { status: 400 });
  if (trimmed.length > 1000) return NextResponse.json({ error: "Comment is too long (1000 characters max)" }, { status: 400 });

  const service = createServiceClient();
  const { data: post } = await service.from("organizer_posts").select("organizer_id").eq("id", postId).single();
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const allowed = await hasCommunityAccess(user.email, post.organizer_id);
  if (!allowed) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { data: comment, error } = await service
    .from("post_comments")
    .insert({ post_id: postId, profile_id: user.id, body: trimmed })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ comment });
}
