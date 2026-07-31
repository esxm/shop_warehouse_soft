"use client";

import { useActionState } from "react";

import {
  updateEmployeeAccess,
  type EmployeeAccessState,
} from "@/app/(protected)/(admin)/users/actions";

const initialState: EmployeeAccessState = {};

export function EmployeeAccessForm({
  active,
  userId,
}: Readonly<{
  active: boolean;
  userId: string;
}>) {
  const [state, formAction, pending] = useActionState(
    updateEmployeeAccess,
    initialState,
  );
  const confirmationId = `deactivate-${userId}`;

  return (
    <form action={formAction} className="min-w-52 space-y-2">
      <input name="active" type="hidden" value={active ? "false" : "true"} />
      <input name="userId" type="hidden" value={userId} />
      {active ? (
        <label
          className="flex min-h-11 items-start gap-3 text-sm text-slate-700"
          htmlFor={confirmationId}
        >
          <input
            className="mt-1 size-5 shrink-0"
            id={confirmationId}
            name="confirmation"
            type="checkbox"
            value="confirm"
          />
          Confirm deactivation
        </label>
      ) : null}
      {state.errors?.confirmation?.map((error) => (
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
      <button
        className={
          active
            ? "w-full rounded-lg border border-red-300 px-3 py-3 text-sm font-semibold text-red-800 disabled:opacity-60 sm:w-auto"
            : "w-full rounded-lg border border-emerald-300 px-3 py-3 text-sm font-semibold text-emerald-800 disabled:opacity-60 sm:w-auto"
        }
        disabled={pending}
        type="submit"
      >
        {pending
          ? "Saving..."
          : active
            ? "Deactivate access"
            : "Reactivate access"}
      </button>
    </form>
  );
}
