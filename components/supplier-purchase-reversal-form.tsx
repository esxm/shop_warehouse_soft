"use client";

import { useActionState } from "react";

import {
  reverseSupplierPurchaseAction,
  type SupplierActionState,
} from "@/app/(protected)/suppliers/actions";

const initialState: SupplierActionState = {};

export function SupplierPurchaseReversalForm({
  supplierId,
  purchaseId,
}: Readonly<{ supplierId: string; purchaseId: string }>) {
  const [state, formAction, pending] = useActionState(
    reverseSupplierPurchaseAction,
    initialState,
  );

  return (
    <form action={formAction} className="mt-4 rounded-xl bg-red-50 p-4">
      <input name="supplierId" type="hidden" value={supplierId} />
      <input name="purchaseId" type="hidden" value={purchaseId} />
      <label
        className="text-sm font-semibold text-red-950"
        htmlFor={`supplier-purchase-reversal-${purchaseId}`}
      >
        Reversal reason
      </label>
      <textarea
        className="mt-2 min-h-20 w-full rounded-xl border border-red-300 bg-white px-3 py-2 text-slate-950"
        id={`supplier-purchase-reversal-${purchaseId}`}
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
          name="allowNegativeStock"
          type="checkbox"
        />
        Allow negative product stock if received pieces have already left this
        location. The reason above will be retained in the audit log.
      </label>

      <label className="mt-3 flex items-start gap-3 text-sm text-red-950">
        <input
          className="mt-1 size-4"
          name="confirmation"
          required
          type="checkbox"
          value="confirm"
        />
        Reverse the payable, inventory value, and every product receipt while
        preserving the original purchase.
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
        {pending ? "Reversing…" : "Reverse supplier purchase"}
      </button>
    </form>
  );
}
