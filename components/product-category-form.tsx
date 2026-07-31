"use client";

import { useActionState } from "react";

import {
  createProductCategoryAction,
  updateProductCategoryAction,
  type ProductActionState,
} from "@/app/(protected)/products/actions";
import type { ProductCategory } from "@/services/products";

const initialState: ProductActionState = {};

export function ProductCategoryForm({
  category,
}: Readonly<{ category?: ProductCategory }>) {
  const isEditing = Boolean(category);
  const action = isEditing
    ? updateProductCategoryAction
    : createProductCategoryAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const inputId = category ? `category-${category.id}` : "new-category";

  return (
    <form action={formAction} className="space-y-2">
      {category ? (
        <input name="categoryId" type="hidden" value={category.id} />
      ) : null}
      <label className="sr-only" htmlFor={inputId}>
        {category ? `Edit ${category.name}` : "New category name"}
      </label>
      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-950"
          defaultValue={category?.name ?? ""}
          id={inputId}
          maxLength={120}
          name="name"
          placeholder="Category name"
          required
        />
        <button
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "Saving..." : category ? "Save" : "Add"}
        </button>
      </div>
      {state.errors?.name?.map((error) => (
        <p className="text-xs text-red-700" key={error}>
          {error}
        </p>
      ))}
      {state.message ? (
        <p
          className={
            state.status === "success"
              ? "text-xs text-emerald-700"
              : "text-xs text-red-700"
          }
          role="status"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
