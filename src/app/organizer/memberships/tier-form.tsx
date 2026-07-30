"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { WORLD_CURRENCIES, currencyLabel } from "@/lib/currencies";
import { computeFees } from "@/lib/fees";

// Creates a membership pass.
//
// The three numbers that define it — price, how many entries, how long they
// last — are shown together with a plain-English summary underneath, because
// "6 entries, ₦40,000, 365 days" is easy to mis-set and expensive to get wrong
// once people have bought one.
export default function TierForm({
  organizerId,
  defaultCurrency,
}: {
  organizerId: string;
  defaultCurrency: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    currency: defaultCurrency,
    credits: "6",
    validityDays: "365",
  });

  const price = Number(form.price);
  const credits = Number(form.credits);
  const perEntry = price > 0 && credits > 0 ? Math.round((price / credits) * 100) / 100 : null;
  const fees = price > 0 ? computeFees(price, form.currency, "pass") : null;

  async function save() {
    setError(null);
    if (!form.name.trim()) return setError("Give the pass a name.");
    if (!(price > 0)) return setError("Set a price.");
    if (!(credits >= 1 && credits <= 12)) return setError("Entries must be between 1 and 12.");

    setSaving(true);
    const { error: insertError } = await createClient().from("membership_tiers").insert({
      organizer_id: organizerId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      price,
      currency: form.currency,
      event_credits: credits,
      validity_days: Number(form.validityDays),
    });
    setSaving(false);
    if (insertError) return setError(insertError.message);

    setForm({ ...form, name: "", description: "", price: "" });
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="zv-btn-primary text-sm">
        + New pass
      </button>
    );
  }

  return (
    <div className="zv-card p-6 space-y-5">
      <h2 className="font-semibold text-neutral-900">New membership pass</h2>

      <div className="space-y-3">
        <div>
          <label className="zv-label">Name</label>
          <input
            className="zv-input"
            placeholder="Season Pass"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>

        <div>
          <label className="zv-label">What members get (optional)</label>
          <textarea
            className="zv-input min-h-[80px] resize-y"
            placeholder="Entry to six nights, plus first access to tickets before public sale."
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="zv-label">Price</label>
            <input
              type="number"
              className="zv-input"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            />
          </div>
          <div>
            <label className="zv-label">Currency</label>
            <select
              className="zv-input"
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
            >
              {WORLD_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {currencyLabel(c)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="zv-label">Entries included</label>
            <select
              className="zv-input"
              value={form.credits}
              onChange={(e) => setForm((f) => ({ ...f, credits: e.target.value }))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "event" : "events"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="zv-label">Valid for</label>
            <select
              className="zv-input"
              value={form.validityDays}
              onChange={(e) => setForm((f) => ({ ...f, validityDays: e.target.value }))}
            >
              <option value="90">3 months</option>
              <option value="180">6 months</option>
              <option value="365">12 months</option>
              <option value="730">2 years</option>
            </select>
          </div>
        </div>
      </div>

      {/* The sanity check. An organizer should see what they've actually built
          before anyone can buy it. */}
      {perEntry !== null && fees && (
        <div className="rounded-2xl bg-neutral-50/80 border border-neutral-100 px-4 py-3 text-sm text-neutral-600 space-y-1">
          <p>
            Members pay <strong className="text-neutral-900">{fees.total.toLocaleString()} {form.currency}</strong>{" "}
            for {credits} {credits === 1 ? "entry" : "entries"} — about{" "}
            {perEntry.toLocaleString()} {form.currency} a night.
          </p>
          <p className="text-neutral-500">
            You receive {fees.organizerReceives.toLocaleString()} {form.currency}. Entries can be used at
            any of your events until the pass expires.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button onClick={save} disabled={saving} className="zv-btn-primary text-sm">
          {saving ? "Creating…" : "Create pass"}
        </button>
        <button onClick={() => setOpen(false)} className="text-sm text-neutral-400 hover:text-neutral-600">
          Cancel
        </button>
      </div>
    </div>
  );
}
