"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DeletePostButton({ postId }: { postId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    if (!confirm("Delete this update? This can't be undone.")) return;
    setDeleting(true);
    const { error } = await createClient().from("organizer_posts").delete().eq("id", postId);
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
      aria-label="Delete post"
      className="text-neutral-500 hover:text-red-400 transition-colors disabled:opacity-40 p-1 -m-1"
    >
      {deleting ? (
        <span className="text-xs">Deleting…</span>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
