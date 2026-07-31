"use client";

import { useActionState } from "react";

import {
  createSupplierAction,
  updateSupplierAction,
  type SupplierActionState,
} from "@/app/(protected)/suppliers/actions";
import type { Supplier } from "@/services/suppliers";

const initialState: SupplierActionState = {};

export function SupplierForm({ supplier }: Readonly<{ supplier?: Supplier }>) {
  const isEditing = Boolean(supplier);
  const action = isEditing ? updateSupplierAction : createSupplierAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-5">
      {supplier ? (
        <input name="supplierId" type="hidden" value={supplier.id} />
      ) : null}
      <div>
        <label
          className="text-sm font-semibold text-slate-800"
          htmlFor="supplier-name"
        >
          Name
        </label>
        <input
          autoComplete="organization"
          className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950"
          defaultValue={supplier?.name}
          id="supplier-name"
          maxLength={120}
          name="name"
          required
        />
        {state.errors?.name?.map((error) => (
          <p className="mt-2 text-sm text-red-700" key={error}>
            {error}
          </p>
        ))}
      </div>
      <div>
        <label
          className="text-sm font-semibold text-slate-800"
          htmlFor="supplier-phone"
        >
          Phone
        </label>
        <input
          autoComplete="tel"
          className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950"
          defaultValue={supplier?.phone ?? ""}
          id="supplier-phone"
          inputMode="tel"
          maxLength={40}
          name="phone"
          type="tel"
        />
        {state.errors?.phone?.map((error) => (
          <p className="mt-2 text-sm text-red-700" key={error}>
            {error}
          </p>
        ))}
      </div>
      <div>
        <label
          className="text-sm font-semibold text-slate-800"
          htmlFor="supplier-currency"
        >
          Default currency
        </label>
        <select
          className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950"
          defaultValue={supplier?.defaultCurrency ?? ""}
          id="supplier-currency"
          name="defaultCurrency"
        >
          <option value="">No default</option>
          <option value="RON">RON</option>
          <option value="USD">USD</option>
        </select>
        {state.errors?.defaultCurrency?.map((error) => (
          <p className="mt-2 text-sm text-red-700" key={error}>
            {error}
          </p>
        ))}
      </div>
      <div>
        <label
          className="text-sm font-semibold text-slate-800"
          htmlFor="supplier-notes"
        >
          Notes
        </label>
        <textarea
          className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950"
          defaultValue={supplier?.notes ?? ""}
          id="supplier-notes"
          maxLength={1000}
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
        className="rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending
          ? isEditing
            ? "Saving..."
            : "Adding..."
          : isEditing
            ? "Save supplier"
            : "Add supplier"}
      </button>
    </form>
  );
}
