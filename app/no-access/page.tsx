import { redirect } from "next/navigation";

import { signOutWithoutAccess } from "@/app/no-access/actions";
import { getAuthState } from "@/lib/auth/session";

export default async function NoAccessPage() {
  const state = await getAuthState();

  if (state.status === "unauthenticated") {
    redirect("/login");
  }

  if (state.status === "member") {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <section className="w-full max-w-lg rounded-3xl border border-amber-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
          Access pending
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
          No active business membership
        </h1>
        <p className="mt-4 leading-7 text-slate-600">
          The account {state.user.email} is signed in, but an administrator has
          not assigned it to an active business.
        </p>
        <form action={signOutWithoutAccess} className="mt-7">
          <button
            className="rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white"
            type="submit"
          >
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}
