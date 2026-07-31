"use client";

import Link from "next/link";
import { useActionState } from "react";

import { login, type LoginState } from "@/app/login/actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <div>
        <label
          className="block text-sm font-semibold text-slate-800"
          htmlFor="email"
        >
          Email
        </label>
        <input
          autoComplete="email"
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
          id="email"
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
      <div>
        <label
          className="block text-sm font-semibold text-slate-800"
          htmlFor="password"
        >
          Password
        </label>
        <input
          autoComplete="current-password"
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
          id="password"
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
      {state.message ? (
        <p
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}
      <button
        className="w-full rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>
      <Link
        className="block text-center text-sm font-semibold text-teal-700 hover:text-teal-900"
        href="/forgot-password"
      >
        Forgot your password?
      </Link>
    </form>
  );
}
