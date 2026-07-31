"use client";

import { useActionState } from "react";

import {
  saveBusinessPositionSnapshotAction,
  type BusinessPositionSnapshotActionState,
} from "@/app/(protected)/reports/business-position/actions";

const initialState: BusinessPositionSnapshotActionState = {};

export function BusinessPositionSnapshotForm({
  snapshotDate,
  usdRonRate,
  rateRequired,
}: Readonly<{
  snapshotDate: string;
  usdRonRate: string | null;
  rateRequired: boolean;
}>) {
  const [state, formAction, pending] = useActionState(
    saveBusinessPositionSnapshotAction,
    initialState,
  );

  return (
    <form action={formAction} className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold text-slate-800">
        Snapshot date
        <input
          className="mt-2 block w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3"
          name="snapshotDate"
          readOnly
          type="date"
          value={snapshotDate}
        />
        {state.errors?.snapshotDate?.map((error) => (
          <span className="mt-2 block text-sm text-red-700" key={error}>
            {error}
          </span>
        ))}
      </label>
      <label className="text-sm font-semibold text-slate-800">
        USD/RON rate captured
        <input
          className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3"
          defaultValue={usdRonRate ?? ""}
          inputMode="decimal"
          name="usdRonRate"
          placeholder={rateRequired ? "Required" : "Optional"}
          required={rateRequired}
        />
        {state.errors?.usdRonRate?.map((error) => (
          <span className="mt-2 block text-sm text-red-700" key={error}>
            {error}
          </span>
        ))}
      </label>
      <button
        className="rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60 sm:col-span-2"
        disabled={pending}
        type="submit"
      >
        {pending ? "Saving snapshot…" : "Save today’s snapshot"}
      </button>
      {state.message ? (
        <p className="text-sm text-red-700 sm:col-span-2" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
