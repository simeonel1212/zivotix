"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import jsQR from "jsqr";

type ScanStatus =
  | "valid"
  | "already_used"
  | "wrong_event"
  | "invalid"
  | "offline"
  // Membership-only outcomes.
  | "members_excluded"
  | "pass_not_valid";

interface ScanOutcome {
  status: ScanStatus;
  ticketType?: string;
  eventTitle?: string;
  /** True when the QR was a membership pass rather than a single-event ticket. */
  isMembership?: boolean;
  memberName?: string;
  creditsLeft?: number;
  creditsTotal?: number;
  message?: string;
}

export default function EventScanner({
  eventId,
  eventTitle,
  initialSold,
  initialScanned,
}: {
  eventId: string;
  eventTitle: string;
  initialSold: number;
  initialScanned: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [result, setResult] = useState<ScanOutcome | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanned, setScanned] = useState(initialScanned);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);

  // Refs rather than state for the scan loop's guards: the requestAnimationFrame
  // callback closes over its first render, so reading state there would see a
  // permanently stale value and let the same code fire on every frame.
  const busyRef = useRef(false);
  const lastTokenRef = useRef<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleDetected = useCallback(
    async (rawText: string) => {
      // Tickets encode a full URL (…/t/<token>); older ones are the bare
      // token. Accept either.
      const token = rawText.split("/t/").pop()?.trim() ?? rawText.trim();
      if (!token) return;

      // A QR code sits in frame for many frames. Without this, one ticket
      // fires a burst of identical requests.
      if (token === lastTokenRef.current) return;
      lastTokenRef.current = token;
      busyRef.current = true;

      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, eventId }),
        });
        const data = await res.json();
        setResult({
          status: data.result,
          ticketType: data.ticketType,
          eventTitle: data.eventTitle,
          isMembership: data.isMembership,
          memberName: data.memberName,
          creditsLeft: data.creditsLeft,
          creditsTotal: data.creditsTotal,
          message: data.message,
        });
        if (data.result === "valid") {
          setScanned((n) => n + 1);
          navigator.vibrate?.(60);
        } else {
          navigator.vibrate?.([40, 60, 40]);
        }
      } catch {
        // A failed request is a network problem, not a bad ticket. Saying
        // "invalid" here would have staff turning away legitimate guests
        // because the venue wifi dropped.
        setResult({ status: "offline" });
        navigator.vibrate?.([40, 60, 40]);
      }

      setTimeout(() => {
        setResult(null);
        busyRef.current = false;
        lastTokenRef.current = null;
      }, 1800);
    },
    [eventId]
  );

  useEffect(() => {
    let raf: number;
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        // Torch is a lifesaver at a dark door, but only some Android devices
        // expose it. iOS Safari does not.
        const track = stream.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as { torch?: boolean } | undefined;
        setTorchAvailable(Boolean(caps?.torch));

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        tick();
      } catch {
        setCameraError(
          "Couldn't open the camera. Allow camera access for this site, then reload."
        );
      }
    }

    function tick() {
      raf = requestAnimationFrame(tick);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA || busyRef.current) {
        return;
      }
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data) handleDetected(code.data);
    }

    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [handleDetected]);

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      // `torch` is a real constraint on Android but isn't in the DOM typings,
      // so it has to be cast through unknown rather than asserted directly.
      await track.applyConstraints({
        advanced: [{ torch: !torchOn }],
      } as unknown as MediaTrackConstraints);
      setTorchOn((t) => !t);
    } catch {
      setTorchAvailable(false);
    }
  }

  const remaining = Math.max(initialSold - scanned, 0);

  return (
    <div className="flex-1 flex flex-col">
      <header className="px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 flex items-center gap-3">
        <Link
          href="/scan"
          aria-label="Back to events"
          className="rounded-full border border-white/15 p-2.5 text-neutral-300 active:scale-95 transition"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate leading-tight">{eventTitle}</p>
          <p className="text-xs text-neutral-400 tabular-nums">
            {scanned} of {initialSold} in · {remaining} to go
          </p>
        </div>
        {torchAvailable && (
          <button
            onClick={toggleTorch}
            aria-label="Toggle torch"
            className={`rounded-full border p-2.5 transition active:scale-95 ${
              torchOn ? "border-yellow-400 bg-yellow-400/20 text-yellow-300" : "border-white/15 text-neutral-300"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </header>

      <div className="relative flex-1 mx-4 mb-[max(1rem,env(safe-area-inset-bottom))] rounded-3xl overflow-hidden ring-1 ring-white/10 bg-black">
        <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />

        {!result && !cameraError && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-5">
            <div className="relative h-60 w-60">
              <span className="absolute left-0 top-0 h-9 w-9 rounded-tl-2xl border-l-[3px] border-t-[3px] border-yellow-400" />
              <span className="absolute right-0 top-0 h-9 w-9 rounded-tr-2xl border-r-[3px] border-t-[3px] border-yellow-400" />
              <span className="absolute bottom-0 left-0 h-9 w-9 rounded-bl-2xl border-b-[3px] border-l-[3px] border-yellow-400" />
              <span className="absolute bottom-0 right-0 h-9 w-9 rounded-br-2xl border-b-[3px] border-r-[3px] border-yellow-400" />
            </div>
            <p className="text-sm text-white/70">Point at the ticket QR code</p>
          </div>
        )}

        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center bg-neutral-950">
            <p className="text-sm text-neutral-300">{cameraError}</p>
            <button onClick={() => location.reload()} className="zv-btn-primary text-sm">
              Reload
            </button>
          </div>
        )}

        {result && <ResultOverlay result={result} />}
      </div>
    </div>
  );
}

function ResultOverlay({ result }: { result: ScanOutcome }) {
  const pass = result.isMembership;

  const config: Record<ScanStatus, { bg: string; glyph: string; title: string; sub?: string }> = {
    valid: { bg: "bg-emerald-500", glyph: "✓", title: "Let them in" },
    already_used: {
      bg: "bg-amber-500",
      glyph: "⚠",
      title: "Already scanned",
      sub: pass ? "This pass is already in tonight" : "This ticket has been used",
    },
    wrong_event: {
      bg: "bg-orange-600",
      glyph: "⤫",
      title: "Wrong event",
      sub: result.eventTitle ? `This ticket is for ${result.eventTitle}` : "Not valid at this door",
    },
    // A real, valid pass — the organizer just excluded this night. Distinct
    // from "invalid" on purpose: the person at the door isn't a chancer, and
    // door staff need to know to sell them a ticket rather than turn them away.
    members_excluded: {
      bg: "bg-orange-600",
      glyph: "⤫",
      title: "Members not included",
      sub: "Passes don't cover this event — sell them a ticket",
    },
    pass_not_valid: {
      bg: "bg-rose-600",
      glyph: "✕",
      title: result.message ?? "Pass not valid",
      sub: "Sell them a ticket instead",
    },
    invalid: { bg: "bg-rose-600", glyph: "✕", title: "Not a valid ticket" },
    offline: {
      bg: "bg-neutral-700",
      glyph: "⇄",
      title: "No connection",
      sub: "Not checked in — try again when you're back online",
    },
  };
  const c = config[result.status] ?? config.invalid;

  return (
    <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center ${c.bg}`}>
      {pass && (
        <span className="mb-1 rounded-full bg-black/20 px-3 py-1 text-xs font-semibold tracking-wide">
          MEMBERSHIP PASS
        </span>
      )}
      <p className="text-7xl leading-none drop-shadow-sm">{c.glyph}</p>
      <p className="mt-2 text-2xl font-bold">{c.title}</p>
      {result.memberName && <p className="text-base font-medium opacity-95">{result.memberName}</p>}
      {c.sub && <p className="text-sm opacity-90">{c.sub}</p>}
      {result.status === "valid" && !pass && result.ticketType && (
        <p className="text-sm opacity-90">{result.ticketType}</p>
      )}
      {result.status === "valid" && pass && result.creditsTotal !== undefined && (
        <p className="text-sm opacity-90 tabular-nums">
          {result.creditsLeft} of {result.creditsTotal} entries left
        </p>
      )}
    </div>
  );
}
