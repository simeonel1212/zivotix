"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { TicketType } from "@/lib/types";

interface RowForm {
  id: string;
  name: string;
  category: string;
  description: string;
  price: string;
  free: boolean;
  quantity_total: string;
  quantity_sold: number;
}

function toRowForm(tt: TicketType): RowForm {
  return {
    id: tt.id,
    name: tt.name,
    category: tt.category ?? "",
    description: tt.description ?? "",
    price: String(tt.price),
    free: tt.price === 0,
    quantity_total: String(tt.quantity_total),
    quantity_sold: tt.quantity_sold,
  };
}

interface TemplateEvent {
  id: string;
  title: string;
  starts_at: string;
  currency: string;
  ticket_types: {
    name: string;
    category: string | null;
    description: string | null;
    price: number;
    quantity_total: number;
    max_per_order: number;
  }[];
}

export default function TicketTypesEditor({
  eventId,
  ticketTypes,
  currency,
  templates = [],
}: {
  eventId: string;
  ticketTypes: TicketType[];
  currency: string;
  /** The organizer's other events, offered as ticket-tier templates. */
  templates?: TemplateEvent[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<RowForm[]>(ticketTypes.map(toRowForm));
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState({
    name: "",
    category: "",
    description: "",
    price: "",
    quantity_total: "",
    free: false,
  });
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  const [copyFrom, setCopyFrom] = useState("");
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const selected = templates.find((t) => t.id === copyFrom);

  // Copies the tiers from a previous event: names, prices, quantities and
  // per-order limits, with sold counts reset to zero. Deliberately additive —
  // it never deletes what's already here, because silently wiping tiers an
  // organizer has already sold against would be unrecoverable.
  async function copyTiers() {
    if (!selected) return;
    setCopyError(null);
    setCopying(true);
    const { error: insertError } = await createClient()
      .from("ticket_types")
      .insert(
        selected.ticket_types.map((tt) => ({
          event_id: eventId,
          name: tt.name,
          category: tt.category,
          description: tt.description,
          // Prices are carried across as-is even if the currencies differ —
          // converting silently would be worse than showing the organizer a
          // number they can see is wrong and fix.
          price: tt.price,
          quantity_total: tt.quantity_total,
          quantity_sold: 0,
          max_per_order: tt.max_per_order,
        }))
      );
    setCopying(false);
    if (insertError) {
      setCopyError(insertError.message);
      return;
    }
    setCopyFrom("");
    router.refresh();
  }

  // Rows are seeded from props once, so without this an added or copied tier
  // wouldn't appear until a full page reload — router.refresh() sends new props
  // down but useState's initial value never runs again. Existing rows keep
  // their local state, which preserves edits in progress on other rows while a
  // neighbour is being saved.
  const signature = ticketTypes
    .map((tt) => `${tt.id}:${tt.name}:${tt.category}:${tt.description}:${tt.price}:${tt.quantity_total}`)
    .join("|");
  const [syncedSignature, setSyncedSignature] = useState(signature);
  if (signature !== syncedSignature) {
    setSyncedSignature(signature);
    setRows((prev) => {
      const byId = new Map(prev.map((r) => [r.id, r]));
      return ticketTypes.map((tt) => byId.get(tt.id) ?? toRowForm(tt));
    });
  }

  function updateRow(id: string, field: keyof RowForm, value: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  // What's on screen versus what's in the database, so the Save button can say
  // which of the two it is. Compared against the props rather than a snapshot
  // in state: after a save router.refresh() sends fresh props down, which is
  // exactly when the row should stop reading as dirty.
  const savedById = useMemo(() => new Map(ticketTypes.map((tt) => [tt.id, tt])), [ticketTypes]);
  function isDirty(row: RowForm) {
    const saved = savedById.get(row.id);
    if (!saved) return true;
    return (
      row.name !== saved.name ||
      row.category.trim() !== (saved.category ?? "") ||
      row.description.trim() !== (saved.description ?? "") ||
      Number(row.price) !== saved.price ||
      Number(row.quantity_total) !== saved.quantity_total
    );
  }

  // Every group name already in use on this event, in the casing it was first
  // typed. Offered as autocomplete so "Tables" and "tables" don't become two
  // headings on the public page — the grouping itself is case-insensitive, but
  // letting an organizer pick the existing name is better than silently
  // rewriting what they typed.
  const existingCategories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) {
      const value = r.category.trim();
      if (!value) continue;
      const key = value.toLowerCase().replace(/\s+/g, " ");
      if (!seen.has(key)) seen.set(key, value);
    }
    return [...seen.values()];
  }, [rows]);

  async function saveRow(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    setErrorId(null);
    const price = Number(row.price);
    const quantityTotal = Number(row.quantity_total);
    if (!row.name.trim() || Number.isNaN(price) || Number.isNaN(quantityTotal)) {
      setErrorId(id);
      setError("Fill in a valid name, price, and quantity.");
      return;
    }
    if (quantityTotal < row.quantity_sold) {
      setErrorId(id);
      setError(`Can't set quantity below ${row.quantity_sold} already sold.`);
      return;
    }
    setSavingId(id);
    const { error: updateError } = await createClient()
      .from("ticket_types")
      .update({
        name: row.name,
        // Empty string means "no category" — stored as null so the event page
        // treats it as ungrouped rather than rendering a blank heading.
        category: row.category.trim() || null,
        description: row.description.trim() || null,
        price,
        quantity_total: quantityTotal,
      })
      .eq("id", id);
    setSavingId(null);
    if (updateError) {
      setErrorId(id);
      setError(updateError.message);
      return;
    }
    router.refresh();
  }

  async function addTicketType() {
    setAddError(null);
    const price = Number(newRow.price);
    const quantityTotal = Number(newRow.quantity_total);
    if (!newRow.name.trim() || Number.isNaN(price) || Number.isNaN(quantityTotal) || quantityTotal < 1) {
      setAddError("Fill in a valid name, price, and quantity.");
      return;
    }
    setAddLoading(true);
    const { error: insertError } = await createClient().from("ticket_types").insert({
      event_id: eventId,
      name: newRow.name,
      category: newRow.category.trim() || null,
      description: newRow.description.trim() || null,
      price,
      quantity_total: quantityTotal,
      quantity_sold: 0,
      max_per_order: 10,
    });
    setAddLoading(false);
    if (insertError) {
      setAddError(insertError.message);
      return;
    }
    // The category is deliberately kept: an organizer adding "Table of 6" has
    // almost certainly got "Table of 10" coming next.
    setNewRow({ name: "", category: newRow.category, description: "", price: "", quantity_total: "", free: false });
    setAdding(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {/* Shared by every group field on the page, so typing "T" offers the
          groups this event already has instead of inviting a near-miss. */}
      <datalist id="zv-ticket-categories">
        {existingCategories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <div className="zv-card divide-y divide-white/10 overflow-hidden">
        {rows.map((row) => (
          <div key={row.id} className="p-3.5 space-y-2">
            {/* Category and description sit on their own line above the
                numbers. Squeezing six fields into one row makes every one of
                them too narrow to read on a phone, which is where most
                organizers actually edit this. */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-2">
              <input
                className="zv-input text-sm"
                placeholder="Group (optional)"
                list="zv-ticket-categories"
                value={row.category}
                onChange={(e) => updateRow(row.id, "category", e.target.value)}
              />
              <textarea
                className="zv-input text-sm min-h-[64px] resize-y leading-relaxed"
                placeholder={"What's included (optional)\nPress Enter for a new line"}
                value={row.description}
                onChange={(e) => updateRow(row.id, "description", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-[2fr_1fr_1fr_auto] gap-2 items-center">
            <input
              className="zv-input text-sm"
              value={row.name}
              onChange={(e) => updateRow(row.id, "name", e.target.value)}
            />
            <div className="space-y-1">
              <input
                type="number"
                className="zv-input text-sm disabled:opacity-50"
                value={row.price}
                disabled={row.free}
                onChange={(e) => updateRow(row.id, "price", e.target.value)}
                placeholder={`Price (${currency})`}
              />
              <label className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                <input
                  type="checkbox"
                  checked={row.free}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setRows((rs) =>
                      rs.map((r) => (r.id === row.id ? { ...r, free: checked, price: checked ? "0" : r.price } : r))
                    );
                  }}
                />
                Free
              </label>
            </div>
            <div>
              <input
                type="number"
                className="zv-input text-sm"
                value={row.quantity_total}
                onChange={(e) => updateRow(row.id, "quantity_total", e.target.value)}
              />
              <p className="text-[11px] text-neutral-500 mt-1">{row.quantity_sold} sold</p>
            </div>
            </div>

            {/* Save on its own line rather than wedged into the field grid.
                Squeezed into the fourth column it wrapped under the inputs on a
                phone and read as part of the quantity box — organizers were
                editing the group name and never seeing anything to press.
                It also states outright when there's something unsaved, because
                a button that looks identical either way teaches nobody. */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-xs text-amber-400">
                {isDirty(row) && savingId !== row.id ? "Unsaved changes" : " "}
              </p>
              <button
                onClick={() => saveRow(row.id)}
                disabled={savingId === row.id || !isDirty(row)}
                className={`text-sm font-semibold px-4 py-2 rounded-full transition-colors disabled:opacity-40 ${
                  isDirty(row)
                    ? "bg-white text-neutral-900 hover:bg-neutral-800"
                    : "bg-white/[0.08] text-neutral-400"
                }`}
              >
                {savingId === row.id ? "Saving…" : isDirty(row) ? "Save changes" : "Saved"}
              </button>
            </div>
            {errorId === row.id && error && <p className="text-xs text-red-400">{error}</p>}
          </div>
        ))}
      </div>

      {adding ? (
        <div className="zv-card p-3.5 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-2">
            <input
              placeholder="Group (e.g. Tables)"
              className="zv-input text-sm"
              list="zv-ticket-categories"
              value={newRow.category}
              onChange={(e) => setNewRow((r) => ({ ...r, category: e.target.value }))}
            />
            <textarea
              className="zv-input text-sm min-h-[64px] resize-y leading-relaxed"
              placeholder={"What's included\nPress Enter for a new line"}
              value={newRow.description}
              onChange={(e) => setNewRow((r) => ({ ...r, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-[2fr_1fr_1fr_auto] gap-2 items-start">
          <input
            placeholder="Name (e.g. VIP)"
            className="zv-input text-sm"
            value={newRow.name}
            onChange={(e) => setNewRow((r) => ({ ...r, name: e.target.value }))}
          />
          <div className="space-y-1">
            <input
              type="number"
              placeholder={`Price (${currency})`}
              className="zv-input text-sm disabled:opacity-50"
              value={newRow.price}
              disabled={newRow.free}
              onChange={(e) => setNewRow((r) => ({ ...r, price: e.target.value }))}
            />
            <label className="flex items-center gap-1.5 text-[11px] text-neutral-400">
              <input
                type="checkbox"
                checked={newRow.free}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setNewRow((r) => ({ ...r, free: checked, price: checked ? "0" : r.price }));
                }}
              />
              Free
            </label>
          </div>
          <input
            type="number"
            placeholder="Quantity"
            className="zv-input text-sm"
            value={newRow.quantity_total}
            onChange={(e) => setNewRow((r) => ({ ...r, quantity_total: e.target.value }))}
          />
          <div className="flex gap-2">
            <button onClick={addTicketType} disabled={addLoading} className="zv-btn-primary text-xs px-3 py-1.5 disabled:opacity-40">
              {addLoading ? "Adding…" : "Add"}
            </button>
            <button onClick={() => setAdding(false)} className="text-xs text-neutral-500 hover:text-neutral-300">
              Cancel
            </button>
          </div>
          {addError && <p className="text-xs text-red-400 col-span-2 sm:col-span-4">{addError}</p>}
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="text-sm font-semibold zv-gradient-text">
          + Add ticket type
        </button>
      )}

      {templates.length > 0 && (
        <div className="zv-card p-4 sm:p-5 space-y-3">
          <div>
            <p className="text-sm font-semibold text-neutral-50">Reuse tiers from a previous event</p>
            <p className="text-xs text-neutral-500 mt-0.5">
              Copies the names, prices, quantities and limits. Nothing already here is removed.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <select
              className="zv-input text-sm"
              value={copyFrom}
              onChange={(e) => {
                setCopyFrom(e.target.value);
                setCopyError(null);
              }}
            >
              <option value="">Choose an event…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} · {new Date(t.starts_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
                  {" · "}
                  {t.ticket_types.length} tier{t.ticket_types.length === 1 ? "" : "s"}
                </option>
              ))}
            </select>
            <button
              onClick={copyTiers}
              disabled={!selected || copying}
              className="zv-btn-secondary text-sm shrink-0 disabled:opacity-40"
            >
              {copying ? "Copying…" : "Copy tiers"}
            </button>
          </div>

          {selected && (
            <div className="rounded-2xl bg-white/[0.04] border border-white/10 px-4 py-3 space-y-1.5">
              {selected.ticket_types.map((tt, i) => (
                <div key={i} className="flex justify-between text-sm text-neutral-300">
                  <span>{tt.name}</span>
                  <span className="tabular-nums">
                    {tt.price > 0 ? `${tt.price.toLocaleString()} ${selected.currency}` : "Free"} ·{" "}
                    {tt.quantity_total}
                  </span>
                </div>
              ))}
              {selected.currency !== currency && (
                <p className="pt-1 text-xs text-amber-400">
                  That event was priced in {selected.currency}, this one is in {currency}. Prices copy
                  across unchanged — check them after.
                </p>
              )}
            </div>
          )}

          {copyError && <p className="text-xs text-red-400">{copyError}</p>}
        </div>
      )}
    </div>
  );
}
