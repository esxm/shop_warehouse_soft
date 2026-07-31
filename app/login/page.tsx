import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { getAuthState } from "@/lib/auth/session";

export const metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
  const state = await getAuthState();

  if (state.status === "member") {
    redirect("/");
  }

  if (state.status === "without-membership") {
    redirect("/no-access");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
          Shop &amp; Warehouse
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
          Sign in
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Use the email and password assigned to your account.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
