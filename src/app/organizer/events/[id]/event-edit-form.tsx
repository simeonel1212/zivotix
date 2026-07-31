"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { EventRow, EventLink } from "@/lib/types";
import LinksInput from "@/components/links-input";
import { EVENT_CATEGORIES } from "@/lib/categories";
import { WORLD_CURRENCIES, currencyLabel } from "@/lib/currencies";

// Converts an ISO timestamp to the "YYYY-MM-DDTHH:mm" shape a
// datetime-local input expects, in the browser's local time.
function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EventEditForm({ event, headerActions }: { event: EventRow; headerActions?: React.ReactNode }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: event.title,
    description: event.description ?? "",
    venue: event.venue ?? "",
    city: event.city ?? "",
    startsAt: toDatetimeLocal(event.starts_at),
    currency: event.currency,
    category: event.category ?? "other",
    isUnlisted: event.is_unlisted ?? false,
    membersIncluded: event.members_included ?? true,
  });
  const [links, setLinks] = useState<EventLink[]>(event.links ?? []);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateDescription() {
    setGenError(null);
    if (!form.title.trim()) {
      setGenError("Add a title first.");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/organizer/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          venue: form.venue,
          city: form.city,
          startsAt: form.startsAt,
          currency: form.currency,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't generate a description");
      setForm((f) => ({ ...f, description: data.description }));
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    const { error: updateError } = await createClient()
      .from("events")
      .update({
        title: form.title,
        description: form.description || null,
        venue: form.venue || null,
        city: form.city || null,
        starts_at: new Date(form.startsAt).toISOString(),
        currency: form.currency,
        category: form.category,
        is_unlisted: form.isUnlisted,
        members_included: form.membersIncluded,
        links: links.filter((l) => l.label.trim() && /^https?:\/\//i.test(l.url.trim())),
      })
      .eq("id", event.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">{event.title}</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {new Date(event.starts_at).toLocaleString()} · {event.venue}, {event.city}
          </p>
        </div>
        {/* Wraps rather than squeezing: three buttons side by side don't fit a
            narrow phone, and shrinking them to fit made the labels unreadable. */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button onClick={() => setEditing(true)} className="zv-btn-secondary">
            Edit details
          </button>
          {headerActions}
        </div>
      </div>
    );
  }

  return (
    <div className="zv-card p-6 sm:p-8 space-y-6">
      <h2 className="font-semibold text-neutral-900">Edit event details</h2>

      <Field label="Title">
        <input className="zv-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
      </Field>

      <Field label="Description">
        <div className="space-y-2">
          <textarea
            className="zv-input min-h-24"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={generateDescription}
              disabled={generating}
              className="zv-badge bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors disabled:opacity-40"
            >
              {generating ? "Writing…" : "✨ Generate with AI"}
            </button>
            {genError && <p className="text-xs text-red-600">{genError}</p>}
          </div>
        </div>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Venue">
          <input className="zv-input" value={form.venue} onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))} />
        </Field>
        <Field label="City">
          <input className="zv-input" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
        </Field>
      </div>

      <LinksInput value={links} onChange={setLinks} />

      <Field label="Category">
        <select className="zv-input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
          {EVENT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={form.isUnlisted}
          onChange={(e) => setForm((f) => ({ ...f, isUnlisted: e.target.checked }))}
          className="mt-0.5 h-4 w-4 shrink-0 accent-yellow-500"
        />
        <span>
          <span className="text-sm font-medium text-neutral-700">Private event (invite only)</span>
          <span className="block text-xs text-neutral-400 mt-0.5">
            Hidden from the homepage, the events page and Google. Anyone with the link can still get
            a ticket.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={!form.membersIncluded}
          onChange={(e) => setForm((f) => ({ ...f, membersIncluded: !e.target.checked }))}
          className="mt-0.5 h-4 w-4 shrink-0 accent-yellow-500"
        />
        <span>
          <span className="text-sm font-medium text-neutral-700">
            Membership passes don&apos;t cover this event
          </span>
          <span className="block text-xs text-neutral-400 mt-0.5">
            By default members get in on their pass. Tick this for a headliner or a special night
            where everyone should buy a ticket — pass holders are told at the door to buy one.
          </span>
        </span>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Date & time">
          <input
            type="datetime-local"
            className="zv-input"
            value={form.startsAt}
            onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
          />
        </Field>
        <Field label="Currency">
          <select className="zv-input" value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>
            {WORLD_CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {currencyLabel(code)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
          className="zv-btn-secondary"
        >
          Cancel
        </button>
        <button type="button" disabled={saving} onClick={save} className="zv-btn-primary disabled:opacity-40">
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="zv-label">{label}</label>
      {children}
    </div>
  );
}
