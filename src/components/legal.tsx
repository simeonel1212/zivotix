import Link from "next/link";
import { ZivotixMark } from "@/components/zivotix-logo";

// Shared chrome for /terms, /privacy and /refund-policy. These three pages
// were previously three near-identical copies of the same layout and Section
// helper; keeping it in one place means a styling change lands on all of them
// and the cross-links between them stay consistent.

// Hard-coded rather than `new Date()`. These pages used to render "Last
// updated <today>" on every request, which is not just wrong but actively
// misleading in a legal document — it claimed a review that never happened.
// Bump this by hand when the wording actually changes.
export const LEGAL_LAST_UPDATED = "26 July 2026";

export const SUPPORT_EMAIL = "support@zivotix.site";
export const LEGAL_ENTITY = "Eden Cloudwave Technology";

export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-12 sm:py-16">
      {/* Branded masthead: these are Zivotix's own documents, not a generic
          legal template, and they should read that way at a glance. */}
      <header className="relative overflow-hidden rounded-3xl bg-neutral-900 px-7 py-9 sm:px-10 sm:py-11">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-yellow-400/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 bottom-[-6rem] h-56 w-56 rounded-full bg-amber-500/15 blur-3xl"
        />
        <div className="relative">
          <span className="inline-flex items-center gap-2">
            <ZivotixMark size={26} />
            <span className="font-bold tracking-tight text-white text-base">
              Zivo<span className="zv-gradient-text">tix</span>
            </span>
          </span>
          <h1 className="mt-5 text-3xl sm:text-4xl font-bold tracking-tight text-white">{title}</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-neutral-300">{intro}</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
            <span>{LEGAL_ENTITY}</span>
            <span aria-hidden="true">·</span>
            <span>zivotix.site</span>
            <span aria-hidden="true">·</span>
            <span>Last updated {LEGAL_LAST_UPDATED}</span>
          </div>
        </div>
      </header>

      <div className="mt-10 space-y-8 text-neutral-700 leading-relaxed">{children}</div>

      <LegalFooterNav />
    </main>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-neutral-900 mb-2">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function SupportLink({ subject }: { subject?: string }) {
  const href = subject
    ? `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`
    : `mailto:${SUPPORT_EMAIL}`;
  return (
    <a href={href} className="font-semibold zv-gradient-text">
      {SUPPORT_EMAIL}
    </a>
  );
}

function LegalFooterNav() {
  return (
    <nav className="mt-14 border-t border-neutral-200/70 pt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-neutral-500">
      <Link href="/terms" className="hover:text-neutral-800 transition-colors">
        Terms of Service
      </Link>
      <Link href="/privacy" className="hover:text-neutral-800 transition-colors">
        Privacy Policy
      </Link>
      <Link href="/refund-policy" className="hover:text-neutral-800 transition-colors">
        Refund Policy
      </Link>
      <Link href="/contact" className="hover:text-neutral-800 transition-colors">
        Contact us
      </Link>
    </nav>
  );
}
