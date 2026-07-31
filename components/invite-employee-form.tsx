"use client";

import { useActionState } from "react";

import {
  inviteEmployee,
  type InviteEmployeeState,
} from "@/app/(protected)/(admin)/users/actions";

const initialState: InviteEmployeeState = {};

export function InviteEmployeeForm() {
  const [state, formAction, pending] = useActionState(
    inviteEmployee,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
    >
      <h2 className="text-lg font-bold text-slate-950">Invite employee</h2>
      <p className="mt-1 text-sm text-slate-600">
        The employee receives an email link and chooses a password.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label
            className="text-sm font-semibold text-slate-800"
            htmlFor="name"
          >
            Full name
          </label>
          <input
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
            id="name"
            name="fullName"
            required
          />
          {state.errors?.fullName?.map((error) => (
            <p className="mt-2 text-sm text-red-700" key={error}>
              {error}
            </p>
          ))}
        </div>
        <div>
          <label
            className="text-sm font-semibold text-slate-800"
            htmlFor="invite-email"
          >
            Email
          </label>
          <input
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
            id="invite-email"
            name="email"
            required
            type="email"
          />
          {state.errors?.email?.map((error) => (
            <p className="mt-2 text-sm text-red-700" key={error}>
              {error}
            </p>
          ))}
        </div>
      </div>
      {state.message ? (
        <p
          className={
            state.status === "success"
              ? "mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              : "mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"
          }
          role="status"
        >
          {state.message}
        </p>
      ) : null}
      <button
        className="mt-5 rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Sending..." : "Send invitation"}
      </button>
    </form>
  );
}
