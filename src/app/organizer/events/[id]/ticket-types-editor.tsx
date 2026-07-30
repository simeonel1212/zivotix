"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { TicketType } from "@/lib/types";

interface RowForm {
  id: string;
  name: string;
  price: string;
  free: boolean;
  quantity_total: string;
  quantity_sold: number;
}

function toRowForm(tt: TicketType): RowForm {
  return {
    id: tt.id,
    name: tt.name,
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
  ticket_types: { name: string; price: number; quantity_total: number; max_per_order: number }[];
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
  const [newRow, setNewRow] = useState({ name: "", price: "", quantity_total: "", free: false });
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

  function updateRow(id: string, field: keyof RowForm, value: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

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
      .update({ name: row.name, price, quantity_total: quantityTotal })
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
    setNewRow({ name: "", price: "", quantity_total: "", free: false });
    setAdding(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="zv-card divide-y divide-neutral-100 overflow-hidden">
        {rows.map((row) => (
          <div key={row.id} className="grid grid-cols-2 sm:grid-cols-[2fr_1fr_1fr_auto] gap-2 items-center p-3.5">
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
              <label className="flex items-center gap-1.5 text-[11px] text-neutral-500">
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
              <p className="text-[11px] text-neutral-400 mt-1">{row.quantity_sold} sold</p>
            </div>
            <button
              onClick={() => saveRow(row.id)}
              disabled={savingId === row.id}
              className="zv-badge bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors disabled:opacity-40 justify-self-start sm:justify-self-auto"
            >
              {savingId === row.id ? "Saving…" : "Save"}
            </button>
            {errorId === row.id && error && <p className="text-xs text-red-600 col-span-2 sm:col-span-4">{error}</p>}
          </div>
        ))}
      </div>

      {adding ? (
        <div className="zv-card p-3.5 grid grid-cols-2 sm:grid-cols-[2fr_1fr_1fr_auto] gap-2 items-start">
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
            <label className="flex items-center gap-1.5 text-[11px] text-neutral-500">
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
            <button onClick={() => setAdding(false)} className="text-xs text-neutral-400 hover:text-neutral-600">
              Cancel
            </button>
          </div>
          {addError && <p className="text-xs text-red-600 col-span-2 sm:col-span-4">{addError}</p>}
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="text-sm font-semibold zv-gradient-text">
          + Add ticket type
        </button>
      )}

      {templates.length > 0 && (
        <div className="zv-card p-4 sm:p-5 space-y-3">
          <div>
            <p className="text-sm font-semibold text-neutral-900">Reuse tiers from a previous event</p>
            <p className="text-xs text-neutral-400 mt-0.5">
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
            <div className="rounded-2xl bg-neutral-50/80 border border-neutral-100 px-4 py-3 space-y-1.5">
              {selected.ticket_types.map((tt, i) => (
                <div key={i} className="flex justify-between text-sm text-neutral-600">
                  <span>{tt.name}</span>
                  <span className="tabular-nums">
                    {tt.price > 0 ? `${tt.price.toLocaleString()} ${selected.currency}` : "Free"} ·{" "}
                    {tt.quantity_total}
                  </span>
                </div>
              ))}
              {selected.currency !== currency && (
                <p className="pt-1 text-xs text-amber-600">
                  That event was priced in {selected.currency}, this one is in {currency}. Prices copy
                  across unchanged — check them after.
                </p>
              )}
            </div>
          )}

          {copyError && <p className="text-xs text-red-600">{copyError}</p>}
        </div>
      )}
    </div>
  );
}
