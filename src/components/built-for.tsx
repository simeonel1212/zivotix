"use client";

import { useState } from "react";
import Link from "next/link";

// "Built for ___" — the same platform, described in the words of one kind of
// organizer at a time.
//
// A generic feature list makes everyone squint and work out whether it applies
// to them. A supper club host doesn't want to hear about festival gates and a
// run club doesn't care about table service. Same product, four translations.
//
// The segments deliberately mirror the ad campaigns, so a person who arrives
// from an Instagram post about run clubs lands on copy that says "run club"
// rather than "event organizers".
const SEGMENTS = [
  {
    key: "parties",
    label: "Parties & club nights",
    headline: "Sell the door before the door opens.",
    body: "Tiered tickets, early bird pricing, and a scanner that works on your phone at the gate — no rented hardware, no laptop on a stool.",
    points: ["Group tickets and tables", "Scan at the door, offline-safe", "Paid out weekly"],
  },
  {
    key: "supper",
    label: "Supper clubs",
    headline: "Shop for a full room, not a maybe.",
    body: "Seats are paid for up front, so you buy ingredients against money that already landed. Every tier can carry its own description — what's included, arrival time, the late-fee warning.",
    points: ["Prepaid seats, no no-shows", "Per-ticket descriptions", "Guest list stays yours"],
  },
  {
    key: "run",
    label: "Run clubs & fitness",
    headline: "They come every week. Charge them once.",
    body: "Sell a pass worth up to twelve events. Members use their entries at any session while the pass is valid, and scan the same code every time.",
    points: ["Passes of 1–12 events", "One QR all season", "Members-only sessions"],
  },
  {
    key: "private",
    label: "Weddings & private events",
    headline: "Invite-only, and actually unlisted.",
    body: "Private events stay off the homepage, off the events page and out of Google. Only people with your link can find them, and you still get the guest list and the door scanner.",
    points: ["Hidden from search", "Link-only access", "RSVP by ticket"],
  },
] as const;

export default function BuiltFor() {
  const [active, setActive] = useState(0);
  const seg = SEGMENTS[active];

  return (
    <section className="zv-card p-7 sm:p-10">
      <h2 className="zv-h2 text-neutral-900">Built for</h2>

      {/* Scrolls sideways rather than wrapping: four labels this long stack
          into three ragged rows on a phone and stop reading as a control. */}
      <div className="mt-5 -mx-7 px-7 sm:mx-0 sm:px-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-2 min-w-max">
          {SEGMENTS.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setActive(i)}
              aria-pressed={i === active}
              className={`zv-badge whitespace-nowrap transition-colors ${
                i === active
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-7 grid gap-6 sm:grid-cols-[1.3fr_1fr] sm:items-start">
        <div>
          <h3 className="zv-h2 text-neutral-900" style={{ fontSize: "clamp(1.35rem, 3vw, 1.9rem)" }}>{seg.headline}</h3>
          <p className="mt-2.5 text-neutral-500 leading-relaxed">{seg.body}</p>
          <Link href="/organizer/events/new" className="zv-btn-primary text-sm mt-6 inline-flex">
            Create your event
          </Link>
        </div>

        <ul className="space-y-2.5">
          {seg.points.map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-sm text-neutral-700">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-400" />
              {p}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
