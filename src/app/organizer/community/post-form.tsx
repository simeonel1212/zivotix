"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import GalleryUpload from "@/components/gallery-upload";

// Direct client-side insert, gated by the organizer_posts_owner_all RLS
// policy — no dedicated API route needed, same pattern as staff management.
export default function PostForm({ organizerId }: { organizerId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  async function generatePost() {
    setGenError(null);
    if (!body.trim()) {
      setGenError("Jot down a quick idea first: a lineup drop, a reminder, whatever's on your mind.");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/organizer/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't generate a caption");
      setBody(data.body);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setPosting(true);
    setError(null);
    const { error } = await createClient()
      .from("organizer_posts")
      .insert({ organizer_id: organizerId, body: body.trim(), image_urls: imageUrls });
    setPosting(false);
    if (error) {
      setError(error.message);
      return;
    }
    setBody("");
    setImageUrls([]);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="zv-card p-6 space-y-4">
      <div>
        <label className="text-sm font-medium text-neutral-200">Post an update</label>
        <p className="text-xs text-neutral-500 mt-1">
          Anyone who&apos;s ever gotten a ticket from you can react and comment. The text and photos
          themselves are public, shown on your community page, the homepage, and search.
        </p>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Share news, lineup drops, behind-the-scenes…"
          rows={4}
          className="zv-input mt-2 resize-none"
        />
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <button
            type="button"
            onClick={generatePost}
            disabled={generating}
            className="zv-badge bg-white/[0.08] text-neutral-200 hover:bg-white/[0.14] transition-colors disabled:opacity-40"
          >
            {generating ? "Writing…" : "✨ Polish with AI"}
          </button>
          {genError && <p className="text-xs text-red-400">{genError}</p>}
        </div>
      </div>
      <GalleryUpload
        value={imageUrls}
        onChange={setImageUrls}
        label="Photos (optional)"
        helpText="Up to 6 photos for this update."
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button disabled={posting || !body.trim()} className="zv-btn-primary">
        {posting ? "Posting…" : "Post update"}
      </button>
    </form>
  );
}
