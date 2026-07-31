"use client";

import { useActionState } from "react";

import {
  deactivateCustomerAction,
  type CustomerActionState,
} from "@/app/(protected)/customers/actions";

const initialState: CustomerActionState = {};

export function CustomerDeactivationForm({
  customerId,
}: Readonly<{ customerId: string }>) {
  const [state, formAction, pending] = useActionState(
    deactivateCustomerAction,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="rounded-2xl border border-red-200 bg-red-50 p-5"
    >
      <input name="customerId" type="hidden" value={customerId} />
      <h2 className="text-lg font-bold text-red-950">Deactivate customer</h2>
      <p className="mt-2 text-sm leading-6 text-red-900">
        The record and its financial history remain available, but the customer
        will no longer appear in the active-only list.
      </p>
      <label className="mt-4 flex min-h-11 items-start gap-3 text-sm text-red-950">
        <input
          className="mt-1 size-5 shrink-0"
          name="confirmation"
          required
          type="checkbox"
          value="confirm"
        />
        I understand this deactivates the customer without deleting history.
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
        {pending ? "Deactivating..." : "Deactivate customer"}
      </button>
    </form>
  );
}
