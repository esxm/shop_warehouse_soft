"use client";

import { useActionState } from "react";

import {
  recordUsdRonReferenceRateAction,
  type DashboardRateActionState,
} from "@/app/(protected)/dashboard-actions";

const initialState: DashboardRateActionState = {};

export function UsdReferenceRateForm({
  defaultEffectiveDate,
}: Readonly<{
  defaultEffectiveDate: string;
}>) {
  const [state, formAction, pending] = useActionState(
    recordUsdRonReferenceRateAction,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto]"
    >
      <label className="text-sm font-semibold text-slate-800">
        USD/RON rate
        <input
          className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3"
          inputMode="decimal"
          name="rate"
          placeholder="4.50000000"
          required
        />
        {state.errors?.rate?.map((error) => (
          <span className="mt-2 block text-sm text-red-700" key={error}>
            {error}
          </span>
        ))}
      </label>
      <label className="text-sm font-semibold text-slate-800">
        Effective date
        <input
          className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3"
          defaultValue={defaultEffectiveDate}
          name="effectiveDate"
          required
          type="date"
        />
        {state.errors?.effectiveDate?.map((error) => (
          <span className="mt-2 block text-sm text-red-700" key={error}>
            {error}
          </span>
        ))}
      </label>
      <button
        className="self-end rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Recording…" : "Record rate"}
      </button>
      {state.message ? (
        <p className="text-sm text-red-700 sm:col-span-3" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
