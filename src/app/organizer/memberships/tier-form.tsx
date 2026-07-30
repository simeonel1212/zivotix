"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { WORLD_CURRENCIES, currencyLabel } from "@/lib/currencies";
import { computeFees } from "@/lib/fees";
import type { MembershipTier } from "@/lib/types";

// Creates or edits a membership pass.
//
// The three numbers that define it — price, how many entries, how long they
// last — are shown together with a plain-English summary underneath, because
// "6 entries, ₦40,000, 365 days" is easy to mis-set and expensive to get wrong
// once people have bought one.
//
// Editing is safe by construction: a membership snapshots credits_total,
// base_amount and expires_at at the moment of purchase, so changing a tier
// never reaches back and alters what someone already paid for. That's worth
// saying out loud in the UI rather than leaving an organizer to guess, because
// the intuitive fear — "will this shortchange my existing members?" — is
// exactly what stops people editing a live product.
export default function TierForm({
  organizerId,
  defaultCurrency,
  tier,
  memberCount = 0,
  onDone,
}: {
  organizerId: string;
  defaultCurrency: string;
  /** Present when editing an existing pass. */
  tier?: MembershipTier;
  /** How many people have already bought this pass. Gates deletion. */
  memberCount?: number;
  /** Called when an edit form should close. */
  onDone?: () => void;
}) {
  const editing = Boolean(tier);
  const router = useRouter();
  const [open, setOpen] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: tier?.name ?? "",
    description: tier?.description ?? "",
    price: tier ? String(tier.price) : "",
    currency: tier?.currency ?? defaultCurrency,
    credits: tier ? String(tier.event_credits) : "6",
    validityDays: tier ? String(tier.validity_days) : "365",
  });

  const price = Number(form.price);
  const credits = Number(form.credits);
  const perEntry = price > 0 && credits > 0 ? Math.round((price / credits) * 100) / 100 : null;
  const fees = price > 0 ? computeFees(price, form.currency, "pass") : null;

  function close() {
    setOpen(false);
    setError(null);
    onDone?.();
  }

  async function save() {
    setError(null);
    if (!form.name.trim()) return setError("Give the pass a name.");
    if (!(price > 0)) return setError("Set a price.");
    if (!(credits >= 1 && credits <= 12)) return setError("Entries must be between 1 and 12.");

    const values = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price,
      currency: form.currency,
      event_credits: credits,
      validity_days: Number(form.validityDays),
    };

    setSaving(true);
    const supabase = createClient();
    const { error: writeError } = tier
      ? await supabase.from("membership_tiers").update(values).eq("id", tier.id)
      : await supabase.from("membership_tiers").insert({ organizer_id: organizerId, ...values });
    setSaving(false);
    if (writeError) return setError(writeError.message);

    if (!tier) setForm({ ...form, name: "", description: "", price: "" });
    close();
    router.refresh();
  }

  async function remove() {
    setError(null);
    setSaving(true);
    const { error: deleteError } = await createClient()
      .from("membership_tiers")
      .delete()
      .eq("id", tier!.id);
    setSaving(false);
    if (deleteError) return setError(deleteError.message);
    close();
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
      <h2 className="font-semibold text-neutral-900">
        {editing ? "Edit pass" : "New membership pass"}
      </h2>

      {/* The reassurance that makes editing usable. Without it an organizer
          with paying members will simply never touch this form. */}
      {editing && memberCount > 0 && (
        <div className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-800">
          {memberCount} {memberCount === 1 ? "person has" : "people have"} already bought this pass.
          Changes here apply to new buyers only — existing members keep the entries, price and expiry
          date they paid for.
        </div>
      )}

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

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={save} disabled={saving} className="zv-btn-primary text-sm">
          {saving ? "Saving…" : editing ? "Save changes" : "Create pass"}
        </button>
        <button onClick={close} className="text-sm text-neutral-400 hover:text-neutral-600">
          Cancel
        </button>

        {/* Deleting is only offered while nothing points at the tier. Once a
            membership references it, the row has to stay for the member's
            record to make sense — taking it off sale is the right move. */}
        {editing && memberCount === 0 && (
          <div className="ml-auto">
            {confirmingDelete ? (
              <span className="flex items-center gap-2 text-sm">
                <span className="text-neutral-500">Delete this pass?</span>
                <button onClick={remove} disabled={saving} className="font-semibold text-red-600">
                  Yes, delete
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="text-neutral-400 hover:text-neutral-600"
                >
                  No
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="text-sm text-neutral-400 hover:text-red-600"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
