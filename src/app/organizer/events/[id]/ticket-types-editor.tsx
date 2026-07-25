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

export default function TicketTypesEditor({
  eventId,
  ticketTypes,
  currency,
}: {
  eventId: string;
  ticketTypes: TicketType[];
  currency: string;
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
    </div>
  );
}
