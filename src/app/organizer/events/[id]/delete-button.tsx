"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Deleting an event is irreversible and there is no undo, so the confirmation
// asks for the event's name rather than a yes/no. A confirm dialog gets
// dismissed reflexively; typing the title cannot be done by accident.
//
// Whether it's allowed at all is decided server-side — anything with a paid
// order or a payout attached is refused there, and the reason comes back as
// plain English for display here.
export default function DeleteEventButton({ eventId, title }: { eventId: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = typed.trim().toLowerCase() === title.trim().toLowerCase();

  async function remove() {
    setError(null);
    setDeleting(true);
    const res = await fetch(`/api/organizer/events/${eventId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setDeleting(false);
      setError(data.error ?? "Could not delete this event.");
      return;
    }
    router.push("/organizer/events");
    router.refresh();
  }

  if (!open) {
    return (
      <div className="zv-card p-5 sm:p-6 border-red-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-neutral-900">Delete this event</p>
            <p className="text-sm text-neutral-500 mt-0.5">
              Gone for good, along with its ticket types. Not possible once someone has paid.
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="text-sm font-semibold text-red-600 hover:text-red-700 shrink-0 text-left sm:text-right"
          >
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="zv-card p-5 sm:p-6 border-red-200 space-y-4">
      <div>
        <p className="font-semibold text-neutral-900">Delete &ldquo;{title}&rdquo;?</p>
        <p className="text-sm text-neutral-500 mt-1">
          This can&apos;t be undone. Type the event name to confirm.
        </p>
      </div>

      <input
        className="zv-input"
        placeholder={title}
        value={typed}
        onChange={(e) => {
          setTyped(e.target.value);
          setError(null);
        }}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={remove}
          disabled={!matches || deleting}
          className="text-sm font-semibold px-4 py-2 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-40"
        >
          {deleting ? "Deleting…" : "Delete for good"}
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setTyped("");
            setError(null);
          }}
          className="text-sm text-neutral-400 hover:text-neutral-600"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
