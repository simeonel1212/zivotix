"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { WORLD_CURRENCIES, currencyLabel } from "@/lib/currencies";

// Lets an organizer change the currency they're paid in.
//
// Not tied to their country: payouts outside the four Paystack markets go out
// through Grey, which sends in any currency. A Lagos organizer running events
// priced in USD may well want paying in USD rather than converting twice.
export default function PayoutCurrencyForm({
  organizerId,
  current,
  disabled,
  disabledReason,
}: {
  organizerId: string;
  current: string;
  /** Paystack-transfer countries settle in their local currency only. */
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [currency, setCurrency] = useState(current);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setSaving(true);
    // Filter on the organizer's own id. RLS would already scope this, but a
    // write keyed on a non-unique column is the kind of thing that quietly
    // updates other people's rows the moment a policy changes.
    const { error: updateError } = await createClient()
      .from("organizers")
      .update({ payout_currency: currency })
      .eq("id", organizerId);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    router.refresh();
  }

  return (
    <div className="zv-card p-6 space-y-4">
      <div>
        <h2 className="font-semibold text-neutral-900">Payout currency</h2>
        <p className="text-sm text-neutral-500 mt-1">
          {disabled
            ? disabledReason
            : "We can pay out in any currency, whatever your country. Sales in other currencies are converted at the live rate on payout day."}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <select
          className="zv-input"
          value={currency}
          disabled={disabled}
          onChange={(e) => setCurrency(e.target.value)}
        >
          {WORLD_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {currencyLabel(c)}
            </option>
          ))}
        </select>
        <button
          onClick={save}
          disabled={disabled || saving || currency === current}
          className="zv-btn-secondary text-sm shrink-0 disabled:opacity-40"
        >
          {saving ? "Saving…" : saved ? "Saved" : "Save"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
