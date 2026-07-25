"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compress-image";

// Shared upload widget used for both the wide event cover image and the
// small square event logo — same upload flow (direct client-side upload to
// the `event-covers` bucket), just different aspect ratio / label / path
// prefix so the two don't collide in storage.
export default function ImageUpload({
  value,
  onChange,
  label,
  aspectClassName = "aspect-[21/9]",
  shapeClassName = "rounded-3xl",
  pathPrefix = "",
  helpText = "JPG or PNG, up to 8MB. We'll automatically resize it.",
  maxDimension = 1600,
}: {
  value: string;
  onChange: (url: string) => void;
  label: string;
  aspectClassName?: string;
  shapeClassName?: string;
  pathPrefix?: string;
  helpText?: string;
  maxDimension?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function upload(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Image must be under 8MB.");
      return;
    }
    setUploading(true);
    try {
      const compressed = await compressImage(file, { maxDimension });

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const ext = compressed.name.split(".").pop();
      const path = `${user.id}/${pathPrefix}${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("event-covers")
        .upload(path, compressed, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage.from("event-covers").getPublicUrl(path);
      onChange(publicUrl.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-neutral-700">{label}</label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) upload(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={`relative ${aspectClassName} ${shapeClassName} border-2 border-dashed cursor-pointer overflow-hidden transition-all duration-300 flex items-center justify-center
          ${dragOver ? "border-yellow-500 bg-yellow-50 scale-[1.01]" : "border-neutral-200 bg-neutral-50 hover:border-yellow-300 hover:bg-yellow-50/40"}`}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="text-center px-4">
            <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/30">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-sm font-medium text-neutral-600">Drop an image, or click to browse</p>
            <p className="text-xs text-neutral-400 mt-1">{helpText}</p>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center">
            <div className="h-8 w-8 rounded-full border-2 border-yellow-500 border-t-transparent animate-spin" />
          </div>
        )}

        {value && !uploading && (
          <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
            <span className="text-white text-sm font-medium">Change image</span>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
