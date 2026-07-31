"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compress-image";

// Multi-photo gallery uploader for event pages. Same direct-to-storage flow
// as the cover/logo uploads (bucket `event-covers`, `gallery-` filename
// prefix), rendered as a thumbnail grid with an add tile and per-photo
// remove buttons.
export default function GalleryUpload({
  value,
  onChange,
  label = "Event photos",
  helpText = "Extra photos shown on your event page (past editions, the venue, the vibe). Optional, up to 6.",
  max = 6,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  label?: string;
  helpText?: string;
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: File[]) {
    setError(null);
    if (value.length + files.length > max) {
      setError(`You can only have up to ${max} photos.`);
      files = files.slice(0, Math.max(0, max - value.length));
      if (files.length === 0) return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const uploaded: string[] = [];
      for (const file of files) {
        if (!file.type.startsWith("image/")) throw new Error("Please choose image files only.");
        if (file.size > 8 * 1024 * 1024) throw new Error("Each image must be under 8MB.");

        const compressed = await compressImage(file, { maxDimension: 1600 });

        const ext = compressed.name.split(".").pop();
        const path = `${user.id}/gallery-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("event-covers")
          .upload(path, compressed, { cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;

        const { data: publicUrl } = supabase.storage.from("event-covers").getPublicUrl(path);
        uploaded.push(publicUrl.publicUrl);
      }
      onChange([...value, ...uploaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-neutral-200">{label}</label>
      <p className="text-xs text-neutral-500">{helpText}</p>

      <div className="grid grid-cols-3 gap-3">
        {value.map((url, i) => (
          <div key={url} className="relative aspect-square rounded-2xl overflow-hidden group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Event photo ${i + 1}`} className="w-full h-full object-cover" />
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => onChange(value.filter((u) => u !== url))}
              className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}

        {value.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="aspect-square rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.04] hover:border-yellow-300 hover:bg-yellow-50/40 transition-all flex flex-col items-center justify-center gap-1.5 text-neutral-500 hover:text-neutral-300 disabled:opacity-50"
          >
            {uploading ? (
              <div className="h-6 w-6 rounded-full border-2 border-yellow-500 border-t-transparent animate-spin" />
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
                <span className="text-xs font-medium">Add photos</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          // Snapshot the files into a plain array *before* resetting the
          // input below — e.target.files is a live FileList tied to the DOM
          // node, so clearing e.target.value would empty it out from under
          // the async upload() call (which only reaches the file loop after
          // an `await`), silently uploading nothing.
          const files = e.target.files ? Array.from(e.target.files) : [];
          e.target.value = "";
          if (files.length) upload(files);
        }}
      />

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
