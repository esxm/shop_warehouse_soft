import Link from "next/link";

export default function SupplierPayableNotFound() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-bold text-slate-950">
        Supplier report not found
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        This supplier does not exist in the current business.
      </p>
      <Link
        className="mt-5 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
        href="/reports/payables"
      >
        Back to supplier payables
      </Link>
    </section>
  );
}
