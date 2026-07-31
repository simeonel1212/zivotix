"use client";

import type { EventLink } from "@/lib/types";

// Label + URL rows for custom event links ("Chat on WhatsApp" → wa.me/...).
// Controlled: parent owns the array, this just renders and edits it.
export default function LinksInput({
  value,
  onChange,
}: {
  value: EventLink[];
  onChange: (links: EventLink[]) => void;
}) {
  function update(i: number, field: keyof EventLink, v: string) {
    onChange(value.map((l, idx) => (idx === i ? { ...l, [field]: v } : l)));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-neutral-200">Links</label>
        {value.length < 4 && (
          <button
            type="button"
            onClick={() => onChange([...value, { label: "", url: "" }])}
            className="text-sm font-semibold zv-gradient-text"
          >
            + Add link
          </button>
        )}
      </div>
      <p className="text-xs text-neutral-500">
        Optional buttons on your event page, like &quot;Chat on WhatsApp&quot; or &quot;Follow us on Instagram&quot;.
      </p>

      {value.map((link, i) => (
        <div key={i} className="flex flex-col sm:flex-row gap-2">
          <input
            placeholder="Label (e.g. Chat on WhatsApp)"
            className="zv-input sm:w-56"
            value={link.label}
            onChange={(e) => update(i, "label", e.target.value)}
          />
          <input
            placeholder="https://wa.me/2348012345678"
            type="url"
            className="zv-input flex-1"
            value={link.url}
            onChange={(e) => update(i, "url", e.target.value)}
          />
          <button
            type="button"
            aria-label="Remove link"
            onClick={() => onChange(value.filter((_, idx) => idx !== i))}
            className="shrink-0 self-center p-2 text-neutral-500 hover:text-red-400 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
