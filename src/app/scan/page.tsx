"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

type ScanResult = "valid" | "already_used" | "invalid";

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [result, setResult] = useState<{ status: ScanResult; ticketType?: string } | null>(null);
  const [scanning, setScanning] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    let stream: MediaStream;
    let raf: number;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        tick();
      } catch {
        setCameraError("Couldn't access the camera. Check browser permissions and try again.");
      }
    }

    function tick() {
      raf = requestAnimationFrame(tick);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA || !scanning || busyRef.current) {
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code) {
        handleDetected(code.data);
      }
    }

    start();
    return () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  async function handleDetected(rawText: string) {
    busyRef.current = true;
    setScanning(false);

    const token = rawText.split("/t/").pop()?.trim() ?? rawText.trim();

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      setResult({ status: data.result, ticketType: data.ticketType });
    } catch {
      setResult({ status: "invalid" });
    }

    setTimeout(() => {
      setResult(null);
      busyRef.current = false;
      setScanning(true);
    }, 2200);
  }

  return (
    <div className="flex-1 flex flex-col bg-black text-white relative">
      <div className="p-5 flex items-center gap-3">
        <div className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500" />
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Scan tickets</h1>
          <p className="text-sm text-neutral-400">Point the camera at a ticket&apos;s QR code.</p>
        </div>
      </div>

      <div className="relative flex-1 mx-4 mb-4 rounded-3xl overflow-hidden ring-1 ring-white/10">
        <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />

        {!result && !cameraError && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-56 w-56 rounded-3xl border-2 border-white/40" />
          </div>
        )}

        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center bg-black/90">
            {cameraError}
          </div>
        )}

        {result && (
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center gap-2 transition-colors ${
              result.status === "valid"
                ? "bg-emerald-500"
                : result.status === "already_used"
                ? "bg-amber-500"
                : "bg-rose-500"
            }`}
          >
            <p className="text-6xl drop-shadow-sm">
              {result.status === "valid" ? "✓" : result.status === "already_used" ? "⚠" : "✕"}
            </p>
            <p className="text-2xl font-semibold">
              {result.status === "valid"
                ? "Valid. Checked in"
                : result.status === "already_used"
                ? "Already used"
                : "Invalid ticket"}
            </p>
            {result.ticketType && <p className="text-sm opacity-90">{result.ticketType}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
