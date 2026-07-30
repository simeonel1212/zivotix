"use client";

import { useEffect, useState } from "react";

// Share control for event pages.
//
// Uses the Web Share API where it exists — on a phone that opens the real
// system sheet, which is what people actually want: WhatsApp, Instagram DM,
// AirDrop, wherever their crowd is. Desktop browsers mostly don't have it, so
// there it falls back to copying the link, which is what a person would do by
// hand anyway.
//
// WhatsApp matters more than any other target here. It's how event links
// actually spread in Nigeria, and the native sheet puts it one tap away.
export default function ShareButton({
  title,
  text,
  url,
  className = "",
  label = "Share",
}: {
  title: string;
  /** Optional message that rides along with the link in the share sheet. */
  text?: string;
  /**
   * What to share. Defaults to the current page — but the organizer dashboard
   * needs to share the *public* event URL, not the dashboard page they're
   * standing on, so it can be passed explicitly.
   */
  url?: string;
  className?: string;
  label?: string;
}) {
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Checked after mount rather than during render: navigator doesn't exist
    // during server rendering, and guessing wrong would flash the wrong label.
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  async function onClick() {
    const target = url ?? window.location.href;
    setError(false);

    if (canShare) {
      try {
        await navigator.share({ title, text, url: target });
        return;
      } catch (e) {
        // AbortError just means they closed the sheet — not a failure worth
        // reporting. Anything else falls through to the clipboard.
        if (e instanceof Error && e.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(target);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard access can be refused (insecure context, permissions).
      // Telling them beats silently doing nothing.
      setError(true);
      setTimeout(() => setError(false), 3000);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={canShare ? `Share ${title}` : `Copy link to ${title}`}
      className={`inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 active:scale-95 ${className}`}
    >
      {copied ? (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-emerald-600">Link copied</span>
        </>
      ) : error ? (
        <span className="text-red-600">Couldn&apos;t copy — long-press the URL</span>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 16V3m0 0L8 7m4-4l4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}
