"use client";

import { useActionState, useState } from "react";

import {
  setStockThresholdAction,
  type StockThresholdActionState,
} from "@/app/(protected)/reports/inventory/actions";
import type { CurrentInventorySourceRow } from "@/lib/reports/inventory-analysis";

const initialState: StockThresholdActionState = {};

export function StockThresholdForm({
  rows,
}: Readonly<{ rows: readonly CurrentInventorySourceRow[] }>) {
  const options = rows.filter((row) => row.productIsActive);
  const [state, formAction, pending] = useActionState(
    setStockThresholdAction,
    initialState,
  );
  const [optionKey, setOptionKey] = useState(
    options[0] ? `${options[0].productId}:${options[0].locationId}` : "",
  );
  const selected = options.find(
    (row) => `${row.productId}:${row.locationId}` === optionKey,
  );

  if (!selected) {
    return <p className="text-sm text-slate-600">No active products exist.</p>;
  }

  return (
    <form
      action={formAction}
      className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_12rem_auto]"
    >
      <input name="productId" type="hidden" value={selected.productId} />
      <input
        name="inventoryLocationId"
        type="hidden"
        value={selected.locationId}
      />
      <label className="text-sm font-semibold text-slate-800">
        Product and location
        <select
          className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
          onChange={(event) => setOptionKey(event.target.value)}
          value={optionKey}
        >
          {options.map((row) => (
            <option
              key={`${row.productId}:${row.locationId}`}
              value={`${row.productId}:${row.locationId}`}
            >
              {row.productCode} · {row.productName} · {row.locationName}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-semibold text-slate-800">
        Minimum pieces
        <input
          className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3"
          defaultValue={selected.minimumQuantity}
          key={optionKey}
          min="0"
          name="minimumQuantity"
          required
          step="1"
          type="number"
        />
        <span className="mt-1 block text-xs font-normal text-slate-500">
          Set zero to disable.
        </span>
      </label>
      <button
        className="w-full self-end rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white disabled:opacity-50 sm:w-auto"
        disabled={pending}
        type="submit"
      >
        {pending ? "Saving..." : "Save threshold"}
      </button>
      {state.message ? (
        <p className="text-sm text-red-700 lg:col-span-3" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
