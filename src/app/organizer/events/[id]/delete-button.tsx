"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Deletes the event.
//
// One tap arms it, the second does it — no typing the title back. Retyping the
// name is the right amount of friction when the thing being destroyed can't be
// recreated, and that isn't the case here: anything with real money attached is
// refused by the server, so the worst outcome is losing a draft you can rebuild
// in a minute. The single confirm is there to catch a mis-tap, nothing more.
export default function DeleteEventButton({ eventId, title }: { eventId: string; title: string }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setError(null);
    setDeleting(true);
    const res = await fetch(`/api/organizer/events/${eventId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setDeleting(false);
      setArmed(false);
      setError(data.error ?? "Could not delete this event.");
      return;
    }
    router.push("/organizer/events");
    router.refresh();
  }

  return (
    <div className="zv-card p-5 sm:p-6 border-red-100 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-neutral-900">
            {armed ? `Delete "${title}"?` : "Delete this event"}
          </p>
          <p className="text-sm text-neutral-500 mt-0.5">
            {armed
              ? "This can't be undone."
              : "Gone for good, along with its ticket types. Not possible once someone has paid for a ticket — free ones don't count."}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {armed && (
            <button
              onClick={() => setArmed(false)}
              className="text-sm text-neutral-400 hover:text-neutral-600"
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => (armed ? remove() : setArmed(true))}
            disabled={deleting}
            className={`text-sm font-semibold shrink-0 transition-colors disabled:opacity-40 ${
              armed
                ? "px-4 py-2 rounded-full bg-red-600 text-white hover:bg-red-700"
                : "text-red-600 hover:text-red-700"
            }`}
          >
            {deleting ? "Deleting…" : armed ? "Yes, delete" : "Delete"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
