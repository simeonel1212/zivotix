import type { Metadata } from "next";
import Link from "next/link";
import { ZivotixMark } from "@/components/zivotix-logo";

export const metadata: Metadata = {
  title: "Zivotix links",
  description: "List your event, find events, or get the Zivotix Scanner app.",
  alternates: { canonical: "/links" },
  // A link-in-bio page has no business ranking in search — it's a router for
  // people arriving from Instagram, and indexing it would compete with the
  // real pages it points at.
  robots: { index: false, follow: true },
};

// Link-in-bio destination for the Instagram profile.
//
// On our own domain rather than a third-party tool: the traffic, the
// analytics and any SEO value stay ours, there's no monthly fee, and it can't
// disappear when someone else's free tier changes.
const LINKS = [
  {
    href: "/organise",
    label: "List your event",
    sub: "Go on sale in minutes. Free to start.",
    primary: true,
  },
  {
    href: "/events",
    label: "Find events",
    sub: "What's on near you, right now.",
  },
  {
    href: "/scanner-app",
    label: "Get the Scanner app",
    sub: "Scan tickets at the door. Android & iPhone.",
  },
];

export default function LinksPage() {
  return (
    <main className="flex-1 relative overflow-hidden bg-black">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-yellow-400/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-28 bottom-[-8rem] h-80 w-80 rounded-full bg-amber-500/15 blur-3xl"
      />

      <div className="relative mx-auto flex w-full max-w-md flex-col items-center px-6 py-16 sm:py-20">
        <ZivotixMark size={56} />
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-white">
          Zivo<span className="zv-gradient-text">tix</span>
        </h1>
        <p className="mt-2 text-center text-sm text-neutral-500">
          Sell out your event. Get paid.
        </p>

        <nav className="mt-10 w-full space-y-3">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`block rounded-2xl px-5 py-4 transition active:scale-[0.98] ${
                l.primary
                  ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-neutral-950 shadow-lg shadow-yellow-500/25"
                  : "border border-white/15 bg-neutral-900/5 text-white hover:bg-neutral-900/10"
              }`}
            >
              <span className="flex items-center justify-between gap-3">
                <span>
                  <span className="block font-semibold">{l.label}</span>
                  <span
                    className={`block text-xs ${
                      l.primary ? "text-neutral-50/70" : "text-neutral-500"
                    }`}
                  >
                    {l.sub}
                  </span>
                </span>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="shrink-0 opacity-60"
                  aria-hidden="true"
                >
                  <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </Link>
          ))}
        </nav>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-neutral-400">
          <Link href="/contact" className="hover:text-neutral-600 transition-colors">
            Contact
          </Link>
          <Link href="/terms" className="hover:text-neutral-600 transition-colors">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-neutral-600 transition-colors">
            Privacy
          </Link>
        </div>

        <p className="mt-8 text-center text-[11px] text-neutral-300">
          zivotix.site · Eden Cloudwave Technology
        </p>
      </div>
    </main>
  );
}
