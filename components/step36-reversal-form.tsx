"use client";

import { useActionState } from "react";

import {
  reverseInventoryExceptionAction,
  reverseSaleReturnAction,
  type ReturnsAndLossesActionState,
} from "@/app/(protected)/returns-and-losses/actions";

const initialState: ReturnsAndLossesActionState = {};

export function Step36ReversalForm({
  kind,
  recordId,
}: Readonly<{
  kind: "sale_return" | "inventory_exception";
  recordId: string;
}>) {
  const action =
    kind === "sale_return"
      ? reverseSaleReturnAction
      : reverseInventoryExceptionAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const fieldName =
    kind === "sale_return" ? "saleReturnId" : "inventoryExceptionId";

  return (
    <form action={formAction} className="mt-4 rounded-xl bg-red-50 p-4">
      <input name={fieldName} type="hidden" value={recordId} />
      <label className="block text-sm font-semibold text-red-950">
        Reversal reason
        <textarea
          className="mt-2 min-h-20 w-full rounded-xl border border-red-300 bg-white px-3 py-2"
          maxLength={500}
          minLength={10}
          name="reason"
          required
        />
      </label>
      <label className="mt-3 flex items-start gap-3 text-sm text-red-950">
        <input
          className="mt-1 size-4"
          name="confirmation"
          required
          type="checkbox"
          value="confirm"
        />
        Create compensating money and stock movements while preserving the
        original record.
      </label>
      {state.message ? (
        <p className="mt-3 text-sm font-medium text-red-800" role="alert">
          {state.message}
        </p>
      ) : null}
      <button
        className="mt-3 rounded-xl bg-red-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        {pending ? "Reversing..." : "Reverse record"}
      </button>
    </form>
  );
}
