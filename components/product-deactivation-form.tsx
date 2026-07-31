"use client";

import { useActionState } from "react";

import {
  deactivateProductAction,
  type ProductActionState,
} from "@/app/(protected)/products/actions";

const initialState: ProductActionState = {};

export function ProductDeactivationForm({
  productId,
}: Readonly<{ productId: string }>) {
  const [state, formAction, pending] = useActionState(
    deactivateProductAction,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="rounded-2xl border border-red-200 bg-red-50 p-5"
    >
      <input name="productId" type="hidden" value={productId} />
      <h2 className="text-lg font-bold text-red-950">Deactivate product</h2>
      <p className="mt-2 text-sm leading-6 text-red-900">
        The product remains in history and cannot be selected for new
        transactions. Product records are never deleted through the app.
      </p>
      <label className="mt-4 flex min-h-11 items-start gap-3 text-sm text-red-950">
        <input
          className="mt-1 size-5 shrink-0"
          name="confirmation"
          required
          type="checkbox"
          value="confirm"
        />
        I understand this deactivates the product without deleting it.
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
        className="mt-4 w-full rounded-xl bg-red-800 px-4 py-3 font-semibold text-white disabled:opacity-60 sm:w-auto"
        disabled={pending}
        type="submit"
      >
        {pending ? "Deactivating..." : "Deactivate product"}
      </button>
    </form>
  );
}
