import Link from "next/link";

import { SupplierForm } from "@/components/supplier-form";
import {
  redirectEmployeeToDailySales,
  requireBusinessMember,
} from "@/lib/auth/session";
import { supplierSearchSchema } from "@/lib/validation/suppliers";
import { searchSuppliers } from "@/services/suppliers";

export default async function SuppliersPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const context = await requireBusinessMember();
  redirectEmployeeToDailySales(context);
  const query = await searchParams;
  const rawSearch = typeof query.q === "string" ? query.q : "";
  const searchResult = supplierSearchSchema.safeParse({
    query: rawSearch,
    includeInactive: query.status === "all",
  });
  const filters = searchResult.success
    ? searchResult.data
    : { query: "", includeInactive: false };
  const suppliers = await searchSuppliers(context, filters);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <form className="flex flex-col gap-3 sm:flex-row" method="get">
          <label className="sr-only" htmlFor="supplier-search">
            Search suppliers
          </label>
          <input
            className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-slate-950"
            defaultValue={filters.query}
            id="supplier-search"
            maxLength={100}
            name="q"
            placeholder="Search by name or phone"
            type="search"
          />
          <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700">
            <input
              defaultChecked={filters.includeInactive}
              name="status"
              type="checkbox"
              value="all"
            />
            Include inactive
          </label>
          <button
            className="w-full rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white sm:w-auto"
            type="submit"
          >
            Search
          </button>
        </form>
        {!searchResult.success ? (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {searchResult.error.issues[0]?.message}
          </p>
        ) : null}

        {suppliers.length === 0 ? (
          <div className="mt-6 rounded-2xl bg-slate-50 p-6 text-sm text-slate-600">
            No suppliers match the current filters.
          </div>
        ) : (
          <ul className="mt-6 max-h-[38rem] divide-y divide-slate-200 overflow-y-auto overscroll-contain pr-2">
            {suppliers.map((supplier) => (
              <li key={supplier.id}>
                <Link
                  className="flex items-center justify-between gap-4 rounded-xl px-2 py-4 transition hover:bg-slate-50"
                  href={`/suppliers/${supplier.id}`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-950">
                      {supplier.name}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {supplier.phone ?? "No phone"} ·{" "}
                      {supplier.defaultCurrency ?? "No default currency"}
                    </p>
                  </div>
                  <span
                    className={
                      supplier.isActive
                        ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800"
                        : "rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                    }
                  >
                    {supplier.isActive ? "Active" : "Inactive"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="h-fit rounded-3xl border border-slate-200 bg-white shadow-sm">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6">
            <span className="text-xl font-bold text-slate-950">
              Add supplier
            </span>
            <span className="text-2xl text-teal-700 transition group-open:rotate-180">
              ↓
            </span>
          </summary>
          <div className="border-t border-slate-200 p-6">
            <p className="text-sm leading-6 text-slate-600">
              Same-name suppliers are allowed. An exact normalized
              name-and-phone duplicate is blocked.
            </p>
            <div className="mt-5">
              <SupplierForm />
            </div>
          </div>
        </details>
      </aside>
    </div>
  );
}
