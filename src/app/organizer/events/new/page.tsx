"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CoverImageUpload from "@/components/cover-image-upload";
import LogoImageUpload from "@/components/logo-image-upload";
import GalleryUpload from "@/components/gallery-upload";
import LinksInput from "@/components/links-input";
import type { EventLink } from "@/lib/types";
import { EVENT_CATEGORIES } from "@/lib/categories";
import { WORLD_CURRENCIES, currencyLabel } from "@/lib/currencies";

interface TicketTypeForm {
  name: string;
  price: string;
  quantity_total: string;
  max_per_order: string;
}

const emptyTicketType: TicketTypeForm = { name: "", price: "", quantity_total: "", max_per_order: "10" };

export default function NewEventPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    description: "",
    venue: "",
    city: "",
    startsAt: "",
    currency: "NGN",
    category: EVENT_CATEGORIES[0].value as string,
    coverImageUrl: "",
    logoImageUrl: "",
    isUnlisted: false,
  });
  const [galleryImageUrls, setGalleryImageUrls] = useState<string[]>([]);
  const [links, setLinks] = useState<EventLink[]>([]);
  const [pricingMode, setPricingMode] = useState<"paid" | "free">("paid");
  const [ticketTypes, setTicketTypes] = useState<TicketTypeForm[]>([{ ...emptyTicketType }]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

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
          ticketTypes: ticketTypes.map((tt) => ({ name: tt.name, price: Number(tt.price) || 0 })),
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

  function updateTicketType(i: number, field: keyof TicketTypeForm, value: string) {
    setTicketTypes((tts) => tts.map((tt, idx) => (idx === i ? { ...tt, [field]: value } : tt)));
  }

  function selectPricingMode(mode: "paid" | "free") {
    setPricingMode(mode);
    if (mode === "free") {
      setTicketTypes((tts) => tts.map((tt) => ({ ...tt, price: "0" })));
    }
  }

  async function submit(status: "draft" | "published") {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/organizer/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          venue: form.venue,
          city: form.city,
          startsAt: form.startsAt,
          currency: form.currency,
          category: form.category,
          coverImageUrl: form.coverImageUrl,
          logoImageUrl: form.logoImageUrl,
          galleryImageUrls,
          links: links.filter((l) => l.label.trim() && l.url.trim()),
          status,
          isUnlisted: form.isUnlisted,
          ticketTypes: ticketTypes.map((tt) => ({
            name: tt.name,
            price: pricingMode === "free" ? 0 : Number(tt.price),
            quantity_total: Number(tt.quantity_total),
            max_per_order: Number(tt.max_per_order),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create event");
      router.push(`/organizer/events/${data.event.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">New event</h1>
        <p className="text-sm text-neutral-500 mt-1">Fill in the details, then publish when you&apos;re ready.</p>
      </div>

      <div className="zv-card p-6 sm:p-8 space-y-6">
        <CoverImageUpload value={form.coverImageUrl} onChange={(url) => setForm((f) => ({ ...f, coverImageUrl: url }))} />

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
              For weddings, private parties and corporate events. Anyone with the link can still get
              a ticket, but it won&apos;t appear on Zivotix&apos;s homepage, the events page, or in Google.
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

        <LogoImageUpload
          value={form.logoImageUrl}
          onChange={(url) => setForm((f) => ({ ...f, logoImageUrl: url }))}
        />

        <GalleryUpload value={galleryImageUrls} onChange={setGalleryImageUrls} />

        <LinksInput value={links} onChange={setLinks} />
      </div>

      <div className="zv-card p-6 sm:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-neutral-900">Ticket types</h2>
          <button
            type="button"
            onClick={() => setTicketTypes((tts) => [...tts, { ...emptyTicketType, price: pricingMode === "free" ? "0" : "" }])}
            className="text-sm font-semibold zv-gradient-text"
          >
            + Add ticket type
          </button>
        </div>

        <div className="flex rounded-xl bg-neutral-100 p-1 w-fit">
          <button
            type="button"
            onClick={() => selectPricingMode("paid")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              pricingMode === "paid" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
            }`}
          >
            Paid event
          </button>
          <button
            type="button"
            onClick={() => selectPricingMode("free")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              pricingMode === "free" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
            }`}
          >
            Free event
          </button>
        </div>

        {ticketTypes.map((tt, i) => (
          <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-2xl border border-neutral-100 bg-neutral-50/60 p-3">
            <input
              placeholder="Name (e.g. Regular)"
              className="zv-input col-span-2"
              value={tt.name}
              onChange={(e) => updateTicketType(i, "name", e.target.value)}
            />
            {pricingMode === "free" ? (
              <div className="zv-input flex items-center text-emerald-600 font-medium">Free</div>
            ) : (
              <input
                placeholder="Price"
                type="number"
                className="zv-input"
                value={tt.price}
                onChange={(e) => updateTicketType(i, "price", e.target.value)}
              />
            )}
            <input
              placeholder="Quantity"
              type="number"
              className="zv-input"
              value={tt.quantity_total}
              onChange={(e) => updateTicketType(i, "quantity_total", e.target.value)}
            />
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button disabled={loading} onClick={() => submit("draft")} className="zv-btn-secondary">
          Save as draft
        </button>
        <button disabled={loading} onClick={() => submit("published")} className="zv-btn-primary">
          Publish
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
