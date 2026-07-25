"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EventRow } from "@/lib/types";

export default function AddStaffForm({ events }: { events: EventRow[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [eventId, setEventId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/organizer/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, eventId: eventId || undefined }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setEmail("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
      <input
        type="email"
        required
        placeholder="staff@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="zv-input flex-1"
      />
      <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="zv-input sm:w-48">
        <option value="">All my events</option>
        {events.map((ev) => (
          <option key={ev.id} value={ev.id}>
            {ev.title}
          </option>
        ))}
      </select>
      <button disabled={loading} className="zv-btn-primary shrink-0">
        Add
      </button>
      {error && <p className="text-sm text-red-600 sm:ml-2 self-center">{error}</p>}
    </form>
  );
}
