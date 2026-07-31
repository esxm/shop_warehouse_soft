"use client";

import { useActionState, useState } from "react";

import {
  createStockMovementAction,
  type StockMovementActionState,
} from "@/app/(protected)/stock/actions";
import type { MemberRole } from "@/lib/auth/types";
import type { StockMovementInput } from "@/lib/validation/stock-movements";
import type { Product } from "@/services/products";
import type { StockLocation } from "@/services/product-stock";

const initialState: StockMovementActionState = {};
type EntryType = StockMovementInput["entryType"];

const entryTypeOptions: readonly {
  value: EntryType;
  label: string;
}[] = [
  { value: "transfer", label: "Transfer between locations" },
  { value: "return", label: "Customer return (stock in)" },
  { value: "damage", label: "Damage / loss (stock out)" },
  { value: "adjustment_in", label: "Count adjustment (stock in)" },
  { value: "adjustment_out", label: "Count adjustment (stock out)" },
];

export function StockMovementForm({
  role,
  products,
  locations,
  businessDayId,
  businessDate,
  requestId,
  referenceId,
}: Readonly<{
  role: MemberRole;
  products: readonly Product[];
  locations: readonly StockLocation[];
  businessDayId: string;
  businessDate: string;
  requestId: string;
  referenceId: string;
}>) {
  const [state, formAction, pending] = useActionState(
    createStockMovementAction,
    initialState,
  );
  const [entryType, setEntryType] = useState<EntryType>("transfer");
  const [unitCostCurrency, setUnitCostCurrency] = useState<"RON" | "USD">(
    "RON",
  );
  const inbound = ["opening", "return", "adjustment_in"].includes(entryType);
  const outbound = ["damage", "adjustment_out"].includes(entryType);
  const transfer = entryType === "transfer";

  if (products.length === 0) {
    return (
      <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
        Add an active product before recording stock.
      </p>
    );
  }

  if (locations.length === 0) {
    return (
      <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
        An active inventory location is required.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <input name="businessDayId" type="hidden" value={businessDayId} />
      <input name="idempotencyKey" type="hidden" value={requestId} />
      <input name="referenceId" type="hidden" value={referenceId} />
      <input name="entryType" type="hidden" value={entryType} />

      <div className="rounded-xl bg-slate-50 p-4">
        <p className="text-sm text-slate-500">Business date</p>
        <p className="mt-1 font-bold text-slate-950">{businessDate}</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label
            className="text-sm font-semibold text-slate-800"
            htmlFor="stock-product"
          >
            Product
          </label>
          <select
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
            id="stock-product"
            name="productId"
            required
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.internalCode} · {product.name}
              </option>
            ))}
          </select>
          {state.errors?.productId?.map((error) => (
            <p className="mt-2 text-sm text-red-700" key={error}>
              {error}
            </p>
          ))}
        </div>

        <div>
          <label
            className="text-sm font-semibold text-slate-800"
            htmlFor="stock-entry-type"
          >
            Movement
          </label>
          <select
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
            id="stock-entry-type"
            onChange={(event) => setEntryType(event.target.value as EntryType)}
            value={entryType}
          >
            {role === "admin" ? (
              <option value="opening">Opening quantity</option>
            ) : null}
            {entryTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {state.errors?.entryType?.map((error) => (
            <p className="mt-2 text-sm text-red-700" key={error}>
              {error}
            </p>
          ))}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2" key={entryType}>
        <div>
          <label
            className="text-sm font-semibold text-slate-800"
            htmlFor="stock-source-location"
          >
            Source location
          </label>
          <select
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 disabled:bg-slate-100"
            disabled={inbound}
            id="stock-source-location"
            name="sourceLocationId"
            required={outbound || transfer}
          >
            <option value="">Select source</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name} ({location.type})
              </option>
            ))}
          </select>
          {state.errors?.sourceLocationId?.map((error) => (
            <p className="mt-2 text-sm text-red-700" key={error}>
              {error}
            </p>
          ))}
        </div>

        <div>
          <label
            className="text-sm font-semibold text-slate-800"
            htmlFor="stock-destination-location"
          >
            Destination location
          </label>
          <select
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 disabled:bg-slate-100"
            disabled={outbound}
            id="stock-destination-location"
            name="destinationLocationId"
            required={inbound || transfer}
          >
            <option value="">Select destination</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name} ({location.type})
              </option>
            ))}
          </select>
          {state.errors?.destinationLocationId?.map((error) => (
            <p className="mt-2 text-sm text-red-700" key={error}>
              {error}
            </p>
          ))}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label
            className="text-sm font-semibold text-slate-800"
            htmlFor="stock-quantity"
          >
            Quantity (pieces)
          </label>
          <input
            className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3"
            id="stock-quantity"
            inputMode="numeric"
            min="1"
            name="quantity"
            required
            step="1"
            type="number"
          />
          {state.errors?.quantity?.map((error) => (
            <p className="mt-2 text-sm text-red-700" key={error}>
              {error}
            </p>
          ))}
        </div>
        {inbound ? (
          <div>
            <label
              className="text-sm font-semibold text-slate-800"
              htmlFor="stock-unit-cost"
            >
              Purchase price per piece
            </label>
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
              <input
                className="block w-full rounded-xl border border-slate-300 px-4 py-3"
                id="stock-unit-cost"
                inputMode="decimal"
                min="0.01"
                name="unitCost"
                placeholder="0.00"
                required
                step="0.01"
                type="number"
              />
              <select
                aria-label="Purchase price currency"
                className="rounded-xl border border-slate-300 bg-white px-3 py-3 font-semibold"
                name="unitCostCurrency"
                onChange={(event) =>
                  setUnitCostCurrency(event.target.value as "RON" | "USD")
                }
                value={unitCostCurrency}
              >
                <option value="RON">RON</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <label className="mt-3 block text-sm font-semibold text-slate-800">
              Exchange rate (RON for 1 USD)
              <input
                className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3"
                inputMode="decimal"
                min="0.00000001"
                name="exchangeRate"
                placeholder="Example: 4.61"
                required
                step="0.00000001"
                type="number"
              />
            </label>
            {state.errors?.unitCost?.map((error) => (
              <p className="mt-2 text-sm text-red-700" key={error}>
                {error}
              </p>
            ))}
            {state.errors?.exchangeRate?.map((error) => (
              <p className="mt-2 text-sm text-red-700" key={error}>
                {error}
              </p>
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-teal-50 p-4 text-sm text-teal-900">
            <input name="unitCost" type="hidden" value="" />
            <input name="unitCostCurrency" type="hidden" value="RON" />
            <input name="exchangeRate" type="hidden" value="" />
            The unit cost is calculated automatically from this product&apos;s
            current weighted average at the source location.
          </div>
        )}
      </div>

      <div>
        <label
          className="text-sm font-semibold text-slate-800"
          htmlFor="stock-notes"
        >
          Notes
        </label>
        <textarea
          className="mt-2 min-h-20 w-full rounded-xl border border-slate-300 px-4 py-3"
          id="stock-notes"
          maxLength={500}
          name="notes"
        />
        {state.errors?.notes?.map((error) => (
          <p className="mt-2 text-sm text-red-700" key={error}>
            {error}
          </p>
        ))}
      </div>

      {role === "admin" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <label className="flex items-start gap-3 text-sm font-semibold text-amber-950">
            <input
              className="mt-1 size-4"
              name="allowNegative"
              type="checkbox"
            />
            Allow negative source stock
          </label>
          <label
            className="mt-4 block text-sm font-semibold text-amber-950"
            htmlFor="stock-override-reason"
          >
            Override reason
          </label>
          <textarea
            className="mt-2 min-h-20 w-full rounded-xl border border-amber-300 bg-white px-4 py-3"
            id="stock-override-reason"
            maxLength={500}
            minLength={10}
            name="overrideReason"
            placeholder="Required only when allowing negative stock."
          />
          {state.errors?.overrideReason?.map((error) => (
            <p className="mt-2 text-sm text-red-700" key={error}>
              {error}
            </p>
          ))}
        </div>
      ) : (
        <>
          <input name="allowNegative" type="hidden" value="" />
          <input name="overrideReason" type="hidden" value="" />
        </>
      )}

      {state.message ? (
        <p className="text-sm font-medium text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}
      <button
        className="w-full rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        disabled={pending}
        type="submit"
      >
        {pending ? "Recording…" : "Record stock movement"}
      </button>
    </form>
  );
}
