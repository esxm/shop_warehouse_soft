import { redirect } from "next/navigation";

import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { getAuthState } from "@/lib/auth/session";

export const metadata = {
  title: "Reset password",
};

export default async function ForgotPasswordPage() {
  const state = await getAuthState();

  if (state.status === "member") {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
          Account security
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
          Reset password
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Enter your account email. For privacy, the response is the same
          whether or not an account exists.
        </p>
        <ForgotPasswordForm />
      </section>
    </main>
  );
}
