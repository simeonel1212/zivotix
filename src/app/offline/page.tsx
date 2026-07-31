import type { Metadata } from "next";
import Link from "next/link";
import { ZivotixMark } from "@/components/zivotix-logo";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

// Served by the service worker when a navigation fails and nothing useful is
// cached. Exists so the installed scanner shows something branded and
// explanatory instead of the browser's dinosaur.
export default function OfflinePage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-4 px-8 py-20 text-center">
      <ZivotixMark size={36} />
      <h1 className="text-xl font-bold tracking-tight text-neutral-50">You&apos;re offline</h1>
      <p className="max-w-sm text-sm text-neutral-400 leading-relaxed">
        The scanner needs a connection to check tickets in. Nothing you scanned while offline was
        recorded, so re-scan those guests once you&apos;re back on.
      </p>
      <Link href="/scan" className="zv-btn-primary mt-2 text-sm">
        Try again
      </Link>
    </main>
  );
}
