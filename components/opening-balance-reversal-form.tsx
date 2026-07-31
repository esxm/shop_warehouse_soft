"use client";

import { useActionState } from "react";

import {
  reverseOpeningBalances,
  type OpeningBalanceReversalState,
} from "@/app/(protected)/(admin)/opening-balances/actions";

const initialState: OpeningBalanceReversalState = {};

export function OpeningBalanceReversalForm({
  batchId,
}: Readonly<{ batchId: string }>) {
  const [state, formAction, pending] = useActionState(
    reverseOpeningBalances,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5"
    >
      <input name="batchId" type="hidden" value={batchId} />
      <h2 className="text-lg font-bold text-red-950">
        Correct through reversal
      </h2>
      <p className="mt-2 text-sm leading-6 text-red-900">
        Reversal creates compensating ledger and inventory movements, marks
        opening receivables and payables as reversed, and preserves the full
        audit history. You can enter a replacement setup afterward.
      </p>
      <div className="mt-5">
        <label className="text-sm font-semibold text-red-950" htmlFor="reason">
          Correction reason
        </label>
        <textarea
          className="mt-2 min-h-28 w-full rounded-xl border border-red-300 bg-white px-4 py-3 text-slate-950"
          id="reason"
          name="reason"
          placeholder="Explain what is incorrect and why reversal is required."
        />
        {state.errors?.reason?.map((error) => (
          <p className="mt-2 text-sm text-red-800" key={error}>
            {error}
          </p>
        ))}
      </div>
      <label className="mt-4 flex items-start gap-3 text-sm text-red-950">
        <input
          className="mt-1 size-4"
          name="confirmation"
          type="checkbox"
          value="confirm"
        />
        I understand this permanently reverses every opening financial effect.
      </label>
      {state.errors?.confirmation?.map((error) => (
        <p className="mt-2 text-sm text-red-800" key={error}>
          {error}
        </p>
      ))}
      {state.message ? (
        <p className="mt-4 text-sm font-medium text-red-900" role="alert">
          {state.message}
        </p>
      ) : null}
      <button
        className="mt-5 rounded-xl bg-red-800 px-4 py-3 font-semibold text-white disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Reversing..." : "Reverse opening balances"}
      </button>
    </form>
  );
}
