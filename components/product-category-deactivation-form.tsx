"use client";

import { useActionState } from "react";

import {
  deactivateProductCategoryAction,
  type ProductActionState,
} from "@/app/(protected)/products/actions";

const initialState: ProductActionState = {};

export function ProductCategoryDeactivationForm({
  categoryId,
  categoryName,
}: Readonly<{ categoryId: string; categoryName: string }>) {
  const [state, formAction, pending] = useActionState(
    deactivateProductCategoryAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input name="categoryId" type="hidden" value={categoryId} />
      <label className="flex min-h-11 items-start gap-3 text-sm text-slate-700">
        <input
          className="mt-1 size-5 shrink-0"
          name="confirmation"
          required
          type="checkbox"
          value="confirm"
        />
        Confirm deactivation of {categoryName}
      </label>
      {state.message ? (
        <p className="text-xs text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}
      <button
        className="w-full rounded-lg border border-red-300 px-3 py-3 text-sm font-semibold text-red-800 disabled:opacity-60 sm:w-auto"
        disabled={pending}
        type="submit"
      >
        {pending ? "Deactivating..." : "Deactivate"}
      </button>
    </form>
  );
}
