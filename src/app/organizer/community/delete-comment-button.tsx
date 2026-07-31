"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Organizer moderation — direct client-side delete, gated by the
// post_comments_owner_all RLS policy (only comments on the organizer's own
// posts), same pattern as DeletePostButton.
export default function DeleteCommentButton({ commentId }: { commentId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    if (!confirm("Remove this comment?")) return;
    setDeleting(true);
    const { error } = await createClient().from("post_comments").delete().eq("id", commentId);
    setDeleting(false);
    if (error) {
      alert(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <button
      onClick={remove}
      disabled={deleting}
      aria-label="Remove comment"
      className="text-neutral-600 hover:text-red-400 transition-colors disabled:opacity-40 shrink-0"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
      </svg>
    </button>
  );
}
