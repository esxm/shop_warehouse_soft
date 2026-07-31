"use client";

import { useActionState } from "react";

import {
  reverseProductSaleAction,
  type ProductSaleActionState,
} from "@/app/(protected)/daily-sales/actions";

const initialState: ProductSaleActionState = {};

export function ProductSaleReversalForm({
  saleId,
}: Readonly<{ saleId: string }>) {
  const [state, formAction, pending] = useActionState(
    reverseProductSaleAction,
    initialState,
  );

  return (
    <form action={formAction} className="mt-4 rounded-xl bg-red-50 p-4">
      <input name="saleId" type="hidden" value={saleId} />
      <label
        className="text-sm font-semibold text-red-950"
        htmlFor={`product-sale-reversal-${saleId}`}
      >
        Correction reason
      </label>
      <textarea
        className="mt-2 min-h-20 w-full rounded-xl border border-red-300 bg-white px-3 py-2 text-slate-950"
        id={`product-sale-reversal-${saleId}`}
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
        Reverse this open-day sale, restore its product stock, and preserve the
        original record in history.
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
        className="mt-3 rounded-xl bg-red-800 px-3 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Reversing..." : "Reverse sale"}
      </button>
    </form>
  );
}
