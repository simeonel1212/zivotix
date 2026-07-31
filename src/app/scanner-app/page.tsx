import type { Metadata } from "next";
import Link from "next/link";
import { ZivotixMark } from "@/components/zivotix-logo";
import InstallButton from "./install-button";

export const metadata: Metadata = {
  title: "Download the Zivotix Scanner app",
  description:
    "Get the Zivotix ticket scanner on Android and iPhone. Scan tickets at the door, see live check-in counts. Free, installs in seconds.",
  alternates: { canonical: "/scanner-app" },
};

// Download page for the scanner.
//
// Android gets a real one-tap install via Chrome's beforeinstallprompt (see
// install-button.tsx). iPhone cannot: Apple permits no app installation from
// a website at all, so the honest thing is clear Safari steps rather than a
// button that pretends to download something.
const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Zivotix Scanner",
  operatingSystem: "Android, iOS",
  applicationCategory: "BusinessApplication",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  description: "Scan event tickets at the door and track live check-in counts.",
};

export default function ScannerAppPage() {
  return (
    <main className="flex-1">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-black">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-yellow-400/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-32 bottom-[-8rem] h-80 w-80 rounded-full bg-amber-500/15 blur-3xl"
        />

        <div className="relative mx-auto max-w-4xl px-6 py-16 sm:py-20">
          <span className="inline-flex items-center gap-2">
            <ZivotixMark size={22} />
            <span className="text-sm font-bold tracking-tight text-white">
              Zivo<span className="zv-gradient-text">tix</span>
            </span>
          </span>

          <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/icon-192.png"
              alt="Zivotix Scanner"
              width={104}
              height={104}
              className="h-26 w-26 shrink-0 rounded-[26px] shadow-2xl shadow-yellow-500/25"
              style={{ width: 104, height: 104 }}
            />
            <div>
              <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white">
                Zivotix Scanner
              </h1>
              <p className="mt-3 max-w-xl text-[15px] sm:text-base leading-relaxed text-neutral-600">
                Check guests in with your phone&apos;s camera. Watch your headcount climb live as
                they walk through the door.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-neutral-500">
                <span>Android &amp; iPhone</span>
                <span aria-hidden="true">·</span>
                <span>Free</span>
                <span aria-hidden="true">·</span>
                <span>No app store needed</span>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col sm:flex-row gap-3">
            <InstallButton />
            <Link
              href="/scan"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-8 py-3.5 text-base font-semibold text-white transition hover:bg-neutral-900/5"
            >
              Open in browser
            </Link>
          </div>
        </div>
      </section>

      {/* What it does */}
      <section className="mx-auto max-w-4xl px-6 py-14">
        <div className="grid gap-4 sm:grid-cols-3">
          <Feature title="Scan in a second">
            Point at the QR code. Green means let them in, amber means the ticket&apos;s already been
            used.
          </Feature>
          <Feature title="Live headcount">
            Every event shows scanned against sold, so you always know who&apos;s still to arrive.
          </Feature>
          <Feature title="Two phones at once">
            Run more than one door. The same ticket can&apos;t get through twice, even scanned at the
            same moment.
          </Feature>
        </div>
      </section>

      {/* Install steps */}
      <section id="how-to-install" className="mx-auto max-w-4xl px-6 pb-14 scroll-mt-8">
        <h2 className="text-2xl font-bold tracking-tight text-neutral-50">Installing it</h2>
        <p className="mt-1.5 text-sm text-neutral-400">
          Do this on the phone you&apos;ll actually use at the door. Takes about fifteen seconds.
        </p>

        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <PlatformCard
            platform="Android"
            icon={<AndroidIcon />}
            note="Chrome, Edge, Samsung Internet or Brave"
          >
            <Step n={1}>
              Tap <strong className="text-neutral-50">Install app</strong> at the top of this page
            </Step>
            <Step n={2}>Confirm in the dialog Chrome shows you</Step>
            <Step n={3}>Zivotix appears in your app drawer</Step>
            <p className="pt-1 text-xs text-neutral-500">
              No install button showing? Open the ⋮ menu and choose Install app.
            </p>
          </PlatformCard>

          <PlatformCard platform="iPhone & iPad" icon={<AppleIcon />} note="Safari only">
            <Step n={1}>
              Open <strong className="text-neutral-50">zivotix.site/scanner-app</strong> in Safari
            </Step>
            <Step n={2}>Tap the Share button, the square with the arrow</Step>
            <Step n={3}>
              Scroll down, tap <strong className="text-neutral-50">Add to Home Screen</strong>
            </Step>
            <Step n={4}>Tap Add. The Zivotix icon lands on your home screen</Step>
            <p className="pt-1 text-xs text-neutral-500">
              Apple doesn&apos;t allow apps to install from a website, so this is the route on iPhone.
              It behaves identically once it&apos;s on your home screen.
            </p>
          </PlatformCard>
        </div>
      </section>

      {/* Practical notes */}
      <section className="mx-auto max-w-4xl px-6 pb-20">
        <div className="zv-card p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-neutral-50">Before the doors open</h2>
          <ul className="mt-3 space-y-2.5 text-sm text-neutral-300 leading-relaxed">
            <li>
              <strong className="text-neutral-50">Sign in on the phone first.</strong> Door staff
              need adding to the event by an organizer, under Staff in the dashboard.
            </li>
            <li>
              <strong className="text-neutral-50">Allow camera access</strong> the first time you
              open it. Without that there&apos;s nothing to scan with.
            </li>
            <li>
              <strong className="text-neutral-50">Check the signal at the venue.</strong> Check-ins
              are recorded on our servers as they happen. If the connection drops the app says so,
              rather than pretending someone was checked in.
            </li>
            <li>
              <strong className="text-neutral-50">It updates itself.</strong> Nothing to download
              again — open it and you have the current version.
            </li>
          </ul>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link href="/organizer/staff" className="zv-btn-secondary text-sm">
              Add door staff
            </Link>
            <Link href="/contact" className="zv-btn-secondary text-sm">
              Get help
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function Feature({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="zv-card p-5">
      <h3 className="text-sm font-semibold text-neutral-50">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-neutral-400">{children}</p>
    </div>
  );
}

function PlatformCard({
  platform,
  icon,
  note,
  children,
}: {
  platform: string;
  icon: React.ReactNode;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div className="zv-card p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-neutral-900">
          {icon}
        </span>
        <div>
          <h3 className="font-semibold text-neutral-50">{platform}</h3>
          <p className="text-xs text-neutral-500">{note}</p>
        </div>
      </div>
      <ol className="mt-5 space-y-3">{children}</ol>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm text-neutral-300">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
        {n}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}

function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.37 12.78c.03 2.9 2.55 3.86 2.58 3.87-.02.07-.4 1.38-1.33 2.73-.8 1.17-1.63 2.33-2.94 2.35-1.29.03-1.7-.76-3.17-.76s-1.93.74-3.15.79c-1.27.05-2.23-1.26-3.03-2.42-1.64-2.38-2.9-6.72-1.21-9.65.84-1.46 2.33-2.38 3.95-2.4 1.24-.03 2.42.84 3.18.84.76 0 2.19-1.04 3.69-.88.63.03 2.4.25 3.53 1.92-.09.06-2.11 1.24-2.1 3.61M14.1 4.5c.67-.81 1.12-1.94 1-3.07-.97.04-2.14.64-2.83 1.45-.62.72-1.16 1.87-1.02 2.97 1.08.09 2.18-.55 2.85-1.35" />
    </svg>
  );
}

function AndroidIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.6 9.48l1.84-3.18a.4.4 0 00-.7-.4l-1.86 3.22a11.4 11.4 0 00-9.76 0L5.26 5.9a.4.4 0 10-.7.4L6.4 9.48A10.7 10.7 0 001 18h22a10.7 10.7 0 00-5.4-8.52M7 15.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5m10 0a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5" />
    </svg>
  );
}
