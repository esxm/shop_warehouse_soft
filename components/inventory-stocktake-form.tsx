"use client";

import { useActionState } from "react";

import {
  createInventoryStocktakeAction,
  type InventoryStocktakeActionState,
} from "@/app/(protected)/inventory-value/actions";
import { formatRON, parseMoneyInput } from "@/lib/money/money";
import type { InventoryLocationBalance } from "@/services/inventory-value";

const initialState: InventoryStocktakeActionState = {};

export function InventoryStocktakeForm({
  requestId,
  defaultDate,
  locations,
}: Readonly<{
  requestId: string;
  defaultDate: string;
  locations: readonly InventoryLocationBalance[];
}>) {
  const [state, formAction, pending] = useActionState(
    createInventoryStocktakeAction,
    initialState,
  );
  const warehouse = locations.find((location) => location.type === "warehouse");
  const shop = locations.find((location) => location.type === "shop");

  if (!warehouse || !shop) {
    return (
      <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
        Both an active warehouse and shop location are required.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <input name="idempotencyKey" type="hidden" value={requestId} />

      <div>
        <label
          className="text-sm font-semibold text-slate-800"
          htmlFor="inventory-stocktake-date"
        >
          Stocktake date
        </label>
        <input
          className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3"
          defaultValue={defaultDate}
          id="inventory-stocktake-date"
          name="stocktakeDate"
          required
          type="date"
        />
        {state.errors?.stocktakeDate?.map((error) => (
          <p className="mt-2 text-sm text-red-700" key={error}>
            {error}
          </p>
        ))}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800">Warehouse</p>
          <p className="mt-1 text-xs text-slate-500">
            Current expected: {formatRON(parseMoneyInput(warehouse.balanceRon))}
          </p>
          <label
            className="mt-4 block text-sm font-semibold text-slate-800"
            htmlFor="inventory-stocktake-warehouse-actual"
          >
            Actual value (RON)
          </label>
          <input
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
            id="inventory-stocktake-warehouse-actual"
            inputMode="decimal"
            name="warehouseActualValueRon"
            placeholder="0.00"
            required
          />
          {state.errors?.warehouseActualValueRon?.map((error) => (
            <p className="mt-2 text-sm text-red-700" key={error}>
              {error}
            </p>
          ))}
        </div>

        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800">Shop</p>
          <p className="mt-1 text-xs text-slate-500">
            Current expected: {formatRON(parseMoneyInput(shop.balanceRon))}
          </p>
          <label
            className="mt-4 block text-sm font-semibold text-slate-800"
            htmlFor="inventory-stocktake-shop-actual"
          >
            Actual value (RON)
          </label>
          <input
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
            id="inventory-stocktake-shop-actual"
            inputMode="decimal"
            name="shopActualValueRon"
            placeholder="0.00"
            required
          />
          {state.errors?.shopActualValueRon?.map((error) => (
            <p className="mt-2 text-sm text-red-700" key={error}>
              {error}
            </p>
          ))}
        </div>
      </div>

      <div>
        <label
          className="text-sm font-semibold text-slate-800"
          htmlFor="inventory-stocktake-reason"
        >
          Reason
        </label>
        <textarea
          className="mt-2 min-h-20 w-full rounded-xl border border-slate-300 px-4 py-3"
          id="inventory-stocktake-reason"
          maxLength={500}
          minLength={10}
          name="reason"
          required
        />
        {state.errors?.reason?.map((error) => (
          <p className="mt-2 text-sm text-red-700" key={error}>
            {error}
          </p>
        ))}
      </div>

      <div>
        <label
          className="text-sm font-semibold text-slate-800"
          htmlFor="inventory-stocktake-notes"
        >
          Notes
        </label>
        <textarea
          className="mt-2 min-h-20 w-full rounded-xl border border-slate-300 px-4 py-3"
          id="inventory-stocktake-notes"
          maxLength={500}
          name="notes"
        />
        {state.errors?.notes?.map((error) => (
          <p className="mt-2 text-sm text-red-700" key={error}>
            {error}
          </p>
        ))}
      </div>

      {state.message ? (
        <p className="text-sm font-medium text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}
      <button
        className="w-full rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white disabled:opacity-60 sm:w-auto"
        disabled={pending}
        type="submit"
      >
        {pending ? "Recording..." : "Record stocktake and adjustments"}
      </button>
    </form>
  );
}
