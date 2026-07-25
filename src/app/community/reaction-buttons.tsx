"use client";

import { useState } from "react";
import Link from "next/link";
import type { ReactionType } from "@/lib/types";

export default function ReactionButtons({
  postId,
  organizerId,
  organizerName,
  initialLikes,
  initialDislikes,
  initialMyReaction,
}: {
  postId: string;
  organizerId: string;
  organizerName: string;
  initialLikes: number;
  initialDislikes: number;
  initialMyReaction: ReactionType | null;
}) {
  const [likes, setLikes] = useState(initialLikes);
  const [dislikes, setDislikes] = useState(initialDislikes);
  const [myReaction, setMyReaction] = useState<ReactionType | null>(initialMyReaction);
  const [pending, setPending] = useState(false);
  const [locked, setLocked] = useState(false);
  // Bump counters remount the inner span below on every click, which
  // restarts the zv-pop CSS animation for free — no animation-library
  // needed, just a key change.
  const [likeBump, setLikeBump] = useState(0);
  const [dislikeBump, setDislikeBump] = useState(0);

  async function react(target: ReactionType) {
    if (pending) return;
    // Clicking an already-active reaction removes it (toggle off); clicking
    // the other one switches straight over. Updates optimistically so the
    // buttons feel instant, and rolls back if the request fails.
    const next: ReactionType | null = myReaction === target ? null : target;
    const prev = { likes, dislikes, myReaction };

    setLikes(likes + (target === "like" ? (next ? 1 : -1) : myReaction === "like" ? -1 : 0));
    setDislikes(dislikes + (target === "dislike" ? (next ? 1 : -1) : myReaction === "dislike" ? -1 : 0));
    setMyReaction(next);
    setLocked(false);
    setPending(true);
    if (target === "like") setLikeBump((n) => n + 1);
    else setDislikeBump((n) => n + 1);

    const res = await fetch("/api/community/react", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, reaction: next }),
    });
    setPending(false);
    if (!res.ok) {
      setLikes(prev.likes);
      setDislikes(prev.dislikes);
      setMyReaction(prev.myReaction);
      // Buttons stay visible either way — the gate is only enforced on
      // click, surfaced here instead of hiding the controls upfront.
      if (res.status === 401 || res.status === 403) setLocked(true);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => react("like")}
          disabled={pending}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
            myReaction === "like" ? "bg-yellow-100 text-yellow-800" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
          }`}
        >
          <span key={likeBump} className="inline-block zv-pop">
            👍 {likes}
          </span>
        </button>
        <button
          onClick={() => react("dislike")}
          disabled={pending}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
            myReaction === "dislike" ? "bg-neutral-200 text-neutral-800" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
          }`}
        >
          <span key={dislikeBump} className="inline-block zv-pop">
            👎 {dislikes}
          </span>
        </button>
      </div>
      {locked && (
        <p className="text-xs text-neutral-400 mt-1.5 text-right">
          Get a ticket from {organizerName} to react.{" "}
          <Link href={`/community/${organizerId}`} className="zv-gradient-text font-medium">
            Get tickets →
          </Link>
        </p>
      )}
    </div>
  );
}
