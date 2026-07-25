"use client";

// Client-side downsize + re-encode before upload, so a multi-MB phone photo
// becomes a few hundred KB with no visible quality loss on screen. Runs in
// the browser (canvas), so it costs nothing server-side and shrinks both
// Supabase Storage usage and image egress at the source, before the file
// ever leaves the browser.
export async function compressImage(
  file: File,
  { maxDimension, quality = 0.82 }: { maxDimension: number; quality?: number }
): Promise<File> {
  // Nothing to gain for already-small files, vector art, or animated GIFs —
  // rasterizing an animated GIF would flatten it to a single frame.
  if (file.size < 150 * 1024 || file.type === "image/svg+xml" || file.type === "image/gif") {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // unsupported format for the browser to decode — upload the original rather than fail
  }

  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // PNGs are sometimes a genuinely transparent logo mark — keep those as
  // PNG. Everything else (photos, screenshots) re-encodes as JPEG, which
  // compresses far smaller for photographic content.
  const keepPng = file.type === "image/png" && hasTransparency(ctx, width, height);
  const outputType = keepPng ? "image/png" : "image/jpeg";

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, outputType, keepPng ? undefined : quality)
  );
  if (!blob || blob.size >= file.size) return file; // re-encode didn't actually help — keep the original

  const newName = file.name.replace(/\.\w+$/, "") + (keepPng ? ".png" : ".jpg");
  return new File([blob], newName, { type: outputType, lastModified: Date.now() });
}

// Samples alpha values across the decoded image rather than reading every
// pixel — cheap, and plenty accurate for deciding "does this PNG actually
// use transparency, or is it just a flattened photo/screenshot."
function hasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  const { data } = ctx.getImageData(0, 0, width, height);
  const maxSamples = 4096;
  const pixelCount = width * height;
  const step = Math.max(1, Math.floor(pixelCount / maxSamples)) * 4;
  for (let i = 3; i < data.length; i += step) {
    if (data[i] < 255) return true;
  }
  return false;
}
