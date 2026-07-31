"use client";

import { useActionState } from "react";

import {
  updatePassword,
  type PasswordState,
} from "@/app/(protected)/set-password/actions";

const initialState: PasswordState = {};

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(
    updatePassword,
    initialState,
  );

  return (
    <form action={formAction} className="mt-7 max-w-lg space-y-5">
      <div>
        <label
          className="block text-sm font-semibold text-slate-800"
          htmlFor="new-password"
        >
          New password
        </label>
        <input
          autoComplete="new-password"
          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
          id="new-password"
          name="password"
          required
          type="password"
        />
        {state.errors?.password?.map((error) => (
          <p className="mt-2 text-sm text-red-700" key={error}>
            {error}
          </p>
        ))}
      </div>
      <div>
        <label
          className="block text-sm font-semibold text-slate-800"
          htmlFor="confirm-password"
        >
          Confirm password
        </label>
        <input
          autoComplete="new-password"
          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3"
          id="confirm-password"
          name="confirmPassword"
          required
          type="password"
        />
        {state.errors?.confirmPassword?.map((error) => (
          <p className="mt-2 text-sm text-red-700" key={error}>
            {error}
          </p>
        ))}
      </div>
      {state.message ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.message}
        </p>
      ) : null}
      <button
        className="rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Saving..." : "Save password"}
      </button>
    </form>
  );
}
