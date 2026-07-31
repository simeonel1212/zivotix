/**
 * Measures an image's width / height by loading it in the browser.
 *
 * Used when a cover is uploaded so the event page can size its frame to the
 * flyer instead of cropping the flyer to the frame. Resolves null rather than
 * rejecting: a missing aspect ratio is a cosmetic fallback, not a failed
 * upload, and it must never block saving the image itself.
 */
export function measureAspect(url: string, timeoutMs = 8000): Promise<number | null> {
  if (typeof window === "undefined") return Promise.resolve(null);

  return new Promise((resolve) => {
    const img = new window.Image();
    const done = (value: number | null) => {
      img.onload = img.onerror = null;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => done(null), timeoutMs);

    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img;
      done(w > 0 && h > 0 ? Math.round((w / h) * 1000) / 1000 : null);
    };
    img.onerror = () => done(null);
    img.src = url;
  });
}
