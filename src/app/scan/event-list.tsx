"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ZivotixMark } from "@/components/zivotix-logo";
import ScannerTabs from "@/components/scanner-tabs";

interface ScannerEvent {
  id: string;
  title: string;
  venue: string | null;
  city: string | null;
  startsAt: string;
  sold: number;
  scanned: number;
}

export default function EventList({
  staffName,
  isOrganizer,
}: {
  staffName: string;
  isOrganizer: boolean;
}) {
  const [events, setEvents] = useState<ScannerEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/scan/events", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load events");
      setEvents(data.events);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load events");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex-1 flex flex-col bg-neutral-950 text-white">
      <header className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-5">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <ZivotixMark size={26} />
            <span className="font-bold tracking-tight text-white">
              Zivo<span className="zv-gradient-text">tix</span>
            </span>
          </span>
          <button
            onClick={load}
            disabled={refreshing}
            aria-label="Refresh"
            className="rounded-full border border-white/15 p-2.5 text-neutral-300 active:scale-95 transition disabled:opacity-40"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className={refreshing ? "animate-spin" : ""}
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 11-2.64-6.36M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Your events</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Signed in as {staffName}. Tap an event to start scanning.
        </p>
      </header>

      <div className="flex-1 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-3">
        {events === null && !error && (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {error && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center">
            <p className="text-sm text-neutral-300">{error}</p>
            <button onClick={load} className="mt-4 zv-btn-primary text-sm">
              Try again
            </button>
          </div>
        )}

        {events?.length === 0 && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="font-semibold">No events to scan</p>
            <p className="mt-1.5 text-sm text-neutral-400">
              You&apos;ll see an event here once you&apos;re added as door staff, or once one of your own
              events has sold a ticket.
            </p>
          </div>
        )}

        {events?.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>

      {/* Tab bar sits on a light surface, so it needs its own wrapper here
          rather than inheriting the dark list background. */}
      <ScannerTabs showCommunity={isOrganizer} />
    </div>
  );
}

function EventCard({ event }: { event: ScannerEvent }) {
  const remaining = Math.max(event.sold - event.scanned, 0);
  const pct = event.sold > 0 ? Math.round((event.scanned / event.sold) * 100) : 0;
  const starts = new Date(event.startsAt);
  const isPast = starts.getTime() < Date.now();

  return (
    <Link
      href={`/scan/${event.id}`}
      className="block rounded-3xl border border-white/10 bg-white/5 p-5 active:scale-[0.99] transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold leading-snug truncate">{event.title}</p>
          <p className="mt-0.5 text-xs text-neutral-400 truncate">
            {starts.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            {" · "}
            {starts.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
            {event.venue ? ` · ${event.venue}` : ""}
          </p>
        </div>
        {!isPast && (
          <span className="zv-badge shrink-0 bg-yellow-400/15 text-yellow-300">Upcoming</span>
        )}
      </div>

      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-2xl font-bold tabular-nums">
            {event.scanned}
            <span className="text-neutral-500 font-semibold text-lg"> / {event.sold}</span>
          </p>
          <p className="text-xs text-neutral-400">scanned in</p>
        </div>
        <p className="text-sm text-neutral-300 tabular-nums">{remaining} to go</p>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-yellow-300 to-yellow-600 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 animate-pulse">
      <div className="h-4 w-2/3 rounded bg-white/10" />
      <div className="mt-2 h-3 w-1/2 rounded bg-white/10" />
      <div className="mt-5 h-7 w-24 rounded bg-white/10" />
      <div className="mt-3 h-1.5 w-full rounded-full bg-white/10" />
    </div>
  );
}
