import { PasswordForm } from "@/components/password-form";

export default function SetPasswordPage() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
        Account security
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
        Choose a password
      </h1>
      <p className="mt-3 max-w-2xl leading-7 text-slate-600">
        Use at least 10 characters and do not reuse a password from another
        service.
      </p>
      <PasswordForm />
    </section>
  );
}
