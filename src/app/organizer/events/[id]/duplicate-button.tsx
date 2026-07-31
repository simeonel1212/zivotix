"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// "Run it again" — duplicates the event into a draft with a new date.
//
// The date field is pre-filled four weeks out and shown up front rather than
// hidden behind a confirm dialog. A duplicate with the wrong date is the one
// mistake this feature could actually cause, so the date is the thing the
// organizer is asked about.
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function DuplicateButton({
  eventId,
  title,
  startsAt,
}: {
  eventId: string;
  title: string;
  startsAt: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = new Date(startsAt);
  next.setDate(next.getDate() + 28);
  const [date, setDate] = useState(toLocalInput(next));
  const [newTitle, setNewTitle] = useState(title);

  async function duplicate() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/organizer/events/${eventId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startsAt: new Date(date).toISOString(), title: newTitle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not duplicate");
      // Straight into the new draft — the next thing they want is to check it,
      // not to be told it worked.
      router.push(`/organizer/events/${data.event.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not duplicate");
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="zv-btn-secondary">
        Run it again
      </button>
    );
  }

  return (
    <div className="zv-card w-full sm:w-[26rem] p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-neutral-50">Run this event again</p>
        <p className="text-xs text-neutral-500 mt-0.5">
          Copies the description, venue, images, links and ticket tiers into a new draft. Sales and
          guests stay with the original.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="zv-label" htmlFor="dup-title">
            Title
          </label>
          <input
            id="dup-title"
            className="zv-input"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="zv-label" htmlFor="dup-date">
            New date &amp; time
          </label>
          <input
            id="dup-date"
            type="datetime-local"
            className="zv-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <p className="mt-1.5 text-xs text-neutral-500">Pre-filled four weeks after the original.</p>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex items-center gap-2">
        <button onClick={duplicate} disabled={loading} className="zv-btn-primary text-sm">
          {loading ? "Duplicating…" : "Create draft"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="text-sm text-neutral-500 hover:text-neutral-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
