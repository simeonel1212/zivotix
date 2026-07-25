import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// Lets a buyer delete their own comment. Organizer moderation (deleting
// anyone's comment on their own posts) goes through direct RLS-gated client
// calls from the organizer dashboard instead — see delete-comment-button.tsx.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const service = createServiceClient();
  const { data: comment } = await service.from("post_comments").select("profile_id").eq("id", id).single();
  if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  if (comment.profile_id !== user.id) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const { error } = await service.from("post_comments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
