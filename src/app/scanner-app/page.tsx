import type { Metadata } from "next";
import Link from "next/link";
import { ZivotixMark } from "@/components/zivotix-logo";

export const metadata: Metadata = {
  title: "Get the Zivotix Scanner app",
  description:
    "Install the Zivotix ticket scanner on any Android or iPhone. Scan tickets at the door, see live check-in counts, no app store needed.",
  alternates: { canonical: "/scanner-app" },
};

// Public install page. Organizers land here from the dashboard and from
// marketing, and door staff land here from the invite email.
//
// There is no App Store or Play Store listing to point at: the scanner is an
// installable web app. That's a genuine advantage worth stating plainly on
// the page rather than apologising for — no download, no updates to chase,
// and it works on both platforms from one link.
export default function ScannerAppPage() {
  return (
    <main className="flex-1 mx-auto w-full max-w-4xl px-6 py-12 sm:py-16">
      <header className="relative overflow-hidden rounded-3xl bg-neutral-900 px-7 py-10 sm:px-10 sm:py-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-yellow-400/25 blur-3xl"
        />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-7">
          <div className="shrink-0">
            {/* The actual installed icon, so what they see here is what lands
                on their home screen. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/icon-192.png"
              alt="Zivotix Scanner app icon"
              width={88}
              height={88}
              className="rounded-[22px] shadow-lg shadow-yellow-500/20"
            />
          </div>
          <div>
            <span className="inline-flex items-center gap-2">
              <ZivotixMark size={22} />
              <span className="font-bold tracking-tight text-white text-sm">
                Zivo<span className="zv-gradient-text">tix</span>
              </span>
            </span>
            <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-white">
              The Scanner app
            </h1>
            <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-neutral-300">
              Check guests in at the door with your phone&apos;s camera. See how many tickets are sold
              and how many have walked in, live, as it happens.
            </p>
          </div>
        </div>
      </header>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Feature title="Scan in a second">
          Point the camera at a ticket. Green means let them in, amber means it&apos;s already been
          used.
        </Feature>
        <Feature title="Live headcount">
          Every event shows scanned against sold, so you always know how many are still to arrive.
        </Feature>
        <Feature title="No app store">
          Installs straight from the browser on Android and iPhone. Nothing to download, nothing to
          update.
        </Feature>
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-bold tracking-tight text-neutral-900">Install it</h2>
        <p className="mt-1.5 text-sm text-neutral-500">
          Takes about fifteen seconds. Do this on the phone you&apos;ll use at the door.
        </p>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <InstallCard platform="iPhone & iPad" note="Must be Safari — Chrome on iOS can't install apps.">
            <Step n={1}>
              Open <strong className="text-neutral-900">zivotix.site/scan</strong> in Safari
            </Step>
            <Step n={2}>Tap the Share button (the square with the arrow)</Step>
            <Step n={3}>
              Scroll down and tap <strong className="text-neutral-900">Add to Home Screen</strong>
            </Step>
            <Step n={4}>Tap Add. The Zivotix icon appears on your home screen</Step>
          </InstallCard>

          <InstallCard platform="Android" note="Works in Chrome, Edge, Samsung Internet and Brave.">
            <Step n={1}>
              Open <strong className="text-neutral-900">zivotix.site/scan</strong> in Chrome
            </Step>
            <Step n={2}>
              Tap the ⋮ menu, top right
            </Step>
            <Step n={3}>
              Tap <strong className="text-neutral-900">Install app</strong> or{" "}
              <strong className="text-neutral-900">Add to Home screen</strong>
            </Step>
            <Step n={4}>Confirm. The Zivotix icon appears in your app drawer</Step>
          </InstallCard>
        </div>
      </section>

      <section className="mt-12 zv-card p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-neutral-900">Before the doors open</h2>
        <ul className="mt-3 space-y-2.5 text-sm text-neutral-600 leading-relaxed">
          <li>
            <strong className="text-neutral-900">Sign in on the phone.</strong> Door staff need to be
            added to the event first — an organizer does that under Staff in the dashboard.
          </li>
          <li>
            <strong className="text-neutral-900">Allow camera access</strong> the first time you open
            the scanner. Without it there&apos;s nothing to scan with.
          </li>
          <li>
            <strong className="text-neutral-900">Check your signal at the venue.</strong> Check-ins
            are recorded on our servers as they happen, so the scanner needs a connection. If it
            drops, the app tells you rather than pretending a guest was checked in.
          </li>
          <li>
            <strong className="text-neutral-900">Two phones scanning is fine.</strong> The same ticket
            can&apos;t be used twice, even if both scan it at the same moment.
          </li>
        </ul>
      </section>

      <div className="mt-10 flex flex-col sm:flex-row gap-3">
        <Link href="/scan" className="zv-btn-primary">
          Open the scanner
        </Link>
        <Link href="/organizer/staff" className="zv-btn-secondary">
          Add door staff
        </Link>
      </div>
    </main>
  );
}

function Feature({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="zv-card p-5">
      <h3 className="font-semibold text-sm text-neutral-900">{title}</h3>
      <p className="mt-1.5 text-sm text-neutral-500 leading-relaxed">{children}</p>
    </div>
  );
}

function InstallCard({
  platform,
  note,
  children,
}: {
  platform: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div className="zv-card p-6">
      <h3 className="font-semibold text-neutral-900">{platform}</h3>
      <p className="mt-1 text-xs text-neutral-400">{note}</p>
      <ol className="mt-4 space-y-3">{children}</ol>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm text-neutral-600">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
        {n}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}
