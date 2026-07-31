"use client";

import Decimal from "decimal.js";
import { useActionState, useState } from "react";

import {
  createInventoryExceptionAction,
  type ReturnsAndLossesActionState,
} from "@/app/(protected)/returns-and-losses/actions";
import type { BusinessDay } from "@/services/business-days";
import type { InventoryExceptionOption } from "@/services/returns-and-losses";

const initialState: ReturnsAndLossesActionState = {};

export function InventoryExceptionForm({
  openDay,
  options,
  requestId,
}: Readonly<{
  openDay: BusinessDay;
  options: readonly InventoryExceptionOption[];
  requestId: string;
}>) {
  const [state, formAction, pending] = useActionState(
    createInventoryExceptionAction,
    initialState,
  );
  const [optionKey, setOptionKey] = useState(
    options[0] ? `${options[0].productId}:${options[0].locationId}` : "",
  );
  const [quantity, setQuantity] = useState("");
  const option = options.find(
    (item) => `${item.productId}:${item.locationId}` === optionKey,
  );
  const estimatedCost = new Decimal(quantity || 0).times(
    option?.averageUnitCostRon ?? 0,
  );

  if (options.length === 0) {
    return (
      <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
        No valued product stock is available for an exception.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <input name="businessDayId" type="hidden" value={openDay.id} />
      <input name="idempotencyKey" type="hidden" value={requestId} />
      <input name="productId" type="hidden" value={option?.productId ?? ""} />
      <input
        name="sourceLocationId"
        type="hidden"
        value={option?.locationId ?? ""}
      />

      <label className="block text-sm font-semibold">
        Product and source location
        <select
          className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
          onChange={(event) => {
            setOptionKey(event.target.value);
            setQuantity("");
          }}
          value={optionKey}
        >
          {options.map((item) => (
            <option
              key={`${item.productId}:${item.locationId}`}
              value={`${item.productId}:${item.locationId}`}
            >
              {item.productCode} · {item.productName} · {item.locationName} ·{" "}
              {item.quantity} available
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Exception type
          <select
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
            name="exceptionType"
          >
            <option value="damage">Damaged product</option>
            <option value="missing">Missing product</option>
            <option value="stolen">Stolen product</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Quantity
          <input
            className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3"
            max={option?.quantity}
            min="1"
            name="quantity"
            onChange={(event) => setQuantity(event.target.value)}
            required
            step="1"
            type="number"
            value={quantity}
          />
        </label>
      </div>

      <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
        Weighted cost:{" "}
        {new Decimal(option?.averageUnitCostRon ?? "0").toFixed(2)} RON per
        piece · estimated inventory reduction: {estimatedCost.toFixed(2)} RON
      </div>

      <label className="block text-sm font-semibold">
        Required reason
        <textarea
          className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 px-4 py-3"
          maxLength={500}
          minLength={10}
          name="reason"
          required
        />
      </label>
      {state.errors?.reason?.map((error) => (
        <p className="text-sm text-red-700" key={error}>
          {error}
        </p>
      ))}
      {state.message ? (
        <p className="text-sm font-medium text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}
      <button
        className="rounded-xl bg-red-800 px-5 py-3 font-semibold text-white disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        {pending ? "Recording..." : "Record inventory exception"}
      </button>
    </form>
  );
}
