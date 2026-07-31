"use client";

import { useActionState } from "react";

import {
  reverseInventoryStocktakeAction,
  type InventoryStocktakeActionState,
} from "@/app/(protected)/inventory-value/actions";

const initialState: InventoryStocktakeActionState = {};

export function InventoryStocktakeReversalForm({
  stocktakeId,
}: Readonly<{ stocktakeId: string }>) {
  const [state, formAction, pending] = useActionState(
    reverseInventoryStocktakeAction,
    initialState,
  );

  return (
    <form action={formAction} className="mt-4 rounded-xl bg-red-50 p-4">
      <input name="stocktakeId" type="hidden" value={stocktakeId} />
      <label
        className="text-sm font-semibold text-red-950"
        htmlFor={`inventory-stocktake-reversal-${stocktakeId}`}
      >
        Reversal reason
      </label>
      <textarea
        className="mt-2 min-h-20 w-full rounded-xl border border-red-300 bg-white px-3 py-2"
        id={`inventory-stocktake-reversal-${stocktakeId}`}
        maxLength={500}
        minLength={10}
        name="reason"
        required
      />
      {state.errors?.reason?.map((error) => (
        <p className="mt-2 text-sm text-red-800" key={error}>
          {error}
        </p>
      ))}
      <label className="mt-3 flex items-start gap-3 text-sm text-red-950">
        <input
          className="mt-1 size-4"
          name="confirmation"
          required
          type="checkbox"
          value="confirm"
        />
        Reverse every adjustment while preserving the expected and actual
        snapshot.
      </label>
      {state.errors?.confirmation?.map((error) => (
        <p className="mt-2 text-sm text-red-800" key={error}>
          {error}
        </p>
      ))}
      {state.message ? (
        <p className="mt-3 text-sm font-medium text-red-800" role="alert">
          {state.message}
        </p>
      ) : null}
      <button
        className="mt-3 rounded-xl bg-red-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Reversing..." : "Reverse stocktake"}
      </button>
    </form>
  );
}
