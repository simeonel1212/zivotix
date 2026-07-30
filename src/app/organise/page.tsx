import type { Metadata } from "next";
import Link from "next/link";
import TicketBackdrop from "@/components/ticket-backdrop";

export const metadata: Metadata = {
  title: "Organise an Event",
  description:
    "Empowering organisers to sell out every show. Create your event, sell tickets in minutes, and get paid fast.",
  alternates: { canonical: "/organise" },
};

// Organiser landing page — vision-led copy in a rich "party" hero box, then
// the three things an organiser actually cares about, then the CTA again.
export default function OrganisePage() {
  return (
    <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-10 space-y-16">
      {/* ---------- Party hero box ---------- */}
      <section className="relative overflow-hidden rounded-[2rem] bg-neutral-950 text-white px-6 py-20 sm:px-16 sm:py-24 text-center shadow-[0_32px_80px_-24px_rgba(0,0,0,0.5)]">
        {/* Party glow */}
        <div
          className="zv-glow-orb w-[480px] h-[480px] -top-40 -left-32 opacity-60"
          style={{ background: "linear-gradient(135deg, #facc15, #ca8a04)" }}
        />
        <div
          className="zv-glow-orb w-[420px] h-[420px] -bottom-32 -right-24 opacity-50"
          style={{ background: "linear-gradient(135deg, #fde047, #b45309)" }}
        />
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-25">
          <TicketBackdrop />
        </div>
        {/* Dot texture over the dark box */}
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            background: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.14) 1px, transparent 0) 0 0/22px 22px",
          }}
        />

        <div className="relative z-10 mx-auto max-w-3xl">
          <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.25em] text-yellow-400">
            For organisers
          </p>
          <h1 className="mt-5 text-4xl sm:text-6xl font-bold tracking-tight leading-[1.08]">
            Empowering organisers to <span className="zv-gradient-text">sell out every show.</span>
          </h1>
          <p className="mt-6 mx-auto max-w-xl text-neutral-300 leading-relaxed">
            Our vision is simple: give independent promoters the same ticketing power as global
            platforms, without the complexity or the cost. Secure payments, instant QR tickets,
            live sales insight. You bring the energy. We handle everything between the
            announcement and the door.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/signup" className="zv-btn-primary">
              Become an Organiser
            </Link>
            <Link href="/events" className="zv-btn-secondary">
              See live events
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- What you get ---------- */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            title: "Full control",
            body: "Create your event page, set ticket tiers and quantities, and go on sale in minutes. Self-service from first draft to sold out, with AI-written event copy when you need it.",
            icon: (
              <>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.98 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.98a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09c0 .68.4 1.3 1.03 1.56a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9c.26.63.88 1.03 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.03Z" strokeLinejoin="round" />
              </>
            ),
          },
          {
            title: "A door that runs itself",
            body: "Every ticket is a unique QR code, verified server-side in real time. Your staff install the free Zivotix Scanner on their own phones. No hardware to rent, no duplicate entries, no arguments at the gate.",
            icon: (
              <>
                <rect x="4" y="4" width="7" height="7" rx="1.5" />
                <rect x="13" y="4" width="7" height="7" rx="1.5" />
                <rect x="4" y="13" width="7" height="7" rx="1.5" />
                <path d="M13 13h3v3h-3zM17 17h3v3h-3z" strokeLinejoin="round" />
              </>
            ),
          },
          {
            title: "Money where you can see it",
            body: "You keep 100% of your ticket price — buyers pay the service fee, not you. Watch sales land in real time, then get paid out weekly straight to your bank account.",
            icon: (
              <>
                <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" strokeLinecap="round" />
              </>
            ),
          },
        ].map((f) => (
          <div key={f.title} className="zv-card p-8">
            <div className="mb-5 h-12 w-12 rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/30">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.7" aria-hidden="true">
                {f.icon}
              </svg>
            </div>
            <h2 className="font-semibold text-lg text-neutral-900">{f.title}</h2>
            <p className="mt-2 text-sm text-neutral-500 leading-relaxed">{f.body}</p>
          </div>
        ))}
      </section>

      {/* ---------- Scanner app ---------- */}
      {/* Sits between the feature grid and the sign-up CTA on purpose: by this
          point an organizer is weighing up whether running the door is going
          to be a hassle, and "your staff already own the hardware" is the
          answer to that. */}
      <section className="relative overflow-hidden rounded-3xl bg-neutral-950 p-8 sm:p-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-yellow-400/20 blur-3xl"
        />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt="Zivotix Scanner app icon"
            width={92}
            height={92}
            style={{ width: 92, height: 92 }}
            className="shrink-0 rounded-[23px] shadow-2xl shadow-yellow-500/25"
          />
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-yellow-400">
              Free with every event
            </p>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-white">
              The Zivotix Scanner app
            </h2>
            <p className="mt-2.5 max-w-lg text-sm sm:text-[15px] leading-relaxed text-neutral-300">
              Installs on any Android or iPhone in seconds. Your door staff scan tickets with the
              camera and watch the headcount climb live. Run two doors at once and the same ticket
              still can&apos;t get through twice.
            </p>
            <Link
              href="/scanner-app"
              className="zv-btn-primary mt-6 inline-flex text-sm"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" aria-hidden="true">
                <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Get the app
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Closing CTA ---------- */}
      <section className="zv-card relative overflow-hidden p-10 sm:p-14 text-center">
        <div
          className="zv-glow-orb w-[360px] h-[360px] -top-24 -right-24"
          style={{ background: "linear-gradient(135deg, #fde047, #eab308)" }}
        />
        <div className="relative z-10">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900">
            Your next event <span className="zv-gradient-text">starts here.</span>
          </h2>
          <p className="mt-4 mx-auto max-w-md text-neutral-500">
            Set up your organiser account in under a minute. No contracts, no setup fees.
          </p>
          <Link href="/signup" className="zv-btn-primary mt-8 inline-flex">
            Become an Organiser
          </Link>
        </div>
      </section>
    </main>
  );
}
