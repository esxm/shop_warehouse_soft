"use client";

import { useActionState } from "react";

import {
  createCustomerAction,
  updateCustomerAction,
  type CustomerActionState,
} from "@/app/(protected)/customers/actions";
import type { Customer } from "@/services/customers";

const initialState: CustomerActionState = {};

export function CustomerForm({ customer }: Readonly<{ customer?: Customer }>) {
  const isEditing = Boolean(customer);
  const action = isEditing ? updateCustomerAction : createCustomerAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-5">
      {customer ? (
        <input name="customerId" type="hidden" value={customer.id} />
      ) : null}
      <div>
        <label className="text-sm font-semibold text-slate-800" htmlFor="name">
          Name
        </label>
        <input
          autoComplete="name"
          className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950"
          defaultValue={customer?.name}
          id="name"
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
        <label className="text-sm font-semibold text-slate-800" htmlFor="phone">
          Phone
        </label>
        <input
          autoComplete="tel"
          className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950"
          defaultValue={customer?.phone ?? ""}
          id="phone"
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
        <label className="text-sm font-semibold text-slate-800" htmlFor="notes">
          Notes
        </label>
        <textarea
          className="mt-2 min-h-28 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950"
          defaultValue={customer?.notes ?? ""}
          id="notes"
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
            ? "Save customer"
            : "Add customer"}
      </button>
    </form>
  );
}
