"use client";

import { useState } from "react";
import Link from "next/link";
import type { PostComment } from "@/lib/types";

export default function CommentThread({
  postId,
  organizerId,
  organizerName,
  currentUserId,
  initialComments,
}: {
  postId: string;
  organizerId: string;
  organizerName: string;
  currentUserId: string | null;
  initialComments: PostComment[];
}) {
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setPosting(true);
    setError(null);
    setLocked(false);
    const res = await fetch("/api/community/comment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, body: trimmed }),
    });
    const data = await res.json();
    setPosting(false);
    if (!res.ok) {
      // The comment box stays visible either way — the ticket gate is only
      // enforced on submit, surfaced here instead of hiding the form upfront.
      if (res.status === 401 || res.status === 403) {
        setLocked(true);
      } else {
        setError(data.error ?? "Could not post that comment");
      }
      return;
    }
    setComments((c) => [...c, data.comment]);
    setBody("");
  }

  async function remove(commentId: string) {
    setComments((c) => c.filter((x) => x.id !== commentId)); // optimistic
    const res = await fetch(`/api/community/comment/${commentId}`, { method: "DELETE" });
    if (!res.ok) {
      // roll back by re-adding — rare (only fails if already deleted elsewhere)
      setComments(initialComments);
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
      {comments.length > 0 && (
        <div className="space-y-2.5">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="text-neutral-200">{c.body}</p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {c.profile_id === currentUserId ? "You" : "Ticket holder"} ·{" "}
                  {new Date(c.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
              {c.profile_id === currentUserId && (
                <button
                  onClick={() => remove(c.id)}
                  aria-label="Delete comment"
                  className="text-neutral-600 hover:text-red-400 transition-colors shrink-0"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="flex items-center gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment…"
          maxLength={1000}
          className="zv-input flex-1 text-sm"
        />
        <button disabled={posting || !body.trim()} className="zv-btn-primary text-sm px-4 py-2 shrink-0">
          {posting ? "…" : "Post"}
        </button>
      </form>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {locked && (
        <p className="text-xs text-neutral-500">
          Get a ticket from {organizerName} to comment.{" "}
          <Link href={`/community/${organizerId}`} className="zv-gradient-text font-medium">
            Get tickets →
          </Link>
        </p>
      )}
    </div>
  );
}
