import { randomUUID } from "node:crypto";
import Link from "next/link";

import { ProductCategoryDeactivationForm } from "@/components/product-category-deactivation-form";
import { ProductCategoryForm } from "@/components/product-category-form";
import { ProductCsvImport } from "@/components/product-csv-import";
import { ProductForm } from "@/components/product-form";
import type { MemberRole } from "@/lib/auth/types";
import type { ProductSearchInput } from "@/lib/validation/products";
import type { Product, ProductCategory } from "@/services/products";

export function ProductManagement({
  role,
  categories,
  products,
  filters,
  searchError,
  importedCount,
}: Readonly<{
  role: MemberRole;
  categories: readonly ProductCategory[];
  products: readonly Product[];
  filters: ProductSearchInput;
  searchError: string | null;
  importedCount: number | null;
}>) {
  const activeCategories = categories.filter((category) => category.isActive);

  return (
    <section className="space-y-6">
      {importedCount !== null ? (
        <p
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-950"
          role="status"
        >
          Imported {importedCount} products.
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
            Product management
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
            Products
          </h2>
          <p className="mt-3 leading-7 text-slate-600">
            Manage product metadata and internal codes below the current stock
            ledger.
          </p>

          <form
            action="/stock#products"
            className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem_auto]"
            method="get"
          >
            <div>
              <label className="sr-only" htmlFor="product-search">
                Search products
              </label>
              <input
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950"
                defaultValue={filters.query}
                id="product-search"
                maxLength={100}
                name="product_q"
                placeholder="Search code, product, or category"
                type="search"
              />
            </div>
            <div>
              <label className="sr-only" htmlFor="product-category-filter">
                Filter category
              </label>
              <select
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950"
                defaultValue={filters.categoryId ?? ""}
                id="product-category-filter"
                name="product_category"
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                    {category.isActive ? "" : " (inactive)"}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="w-full rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white md:w-auto"
              type="submit"
            >
              Search
            </button>
            <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-3">
              <input
                defaultChecked={filters.includeInactive}
                name="product_status"
                type="checkbox"
                value="all"
              />
              Include inactive products
            </label>
          </form>
          {searchError ? (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {searchError}
            </p>
          ) : null}

          {products.length === 0 ? (
            <p className="mt-6 rounded-2xl bg-slate-50 p-6 text-sm text-slate-600">
              No products match the current filters.
            </p>
          ) : (
            <ul className="mt-6 max-h-[36rem] divide-y divide-slate-200 overflow-y-auto overscroll-contain pr-2">
              {products.map((product) => (
                <li key={product.id}>
                  <Link
                    className="grid gap-3 rounded-xl px-2 py-4 transition hover:bg-slate-50 sm:grid-cols-[8rem_minmax(0,1fr)_auto]"
                    href={`/products/${product.id}`}
                  >
                    <span className="font-mono text-sm font-semibold text-teal-800">
                      {product.internalCode}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-slate-950">
                        {product.name}
                      </span>
                      <span className="mt-1 block text-sm text-slate-500">
                        {product.categoryName} · piece
                      </span>
                    </span>
                    <span
                      className={
                        product.isActive
                          ? "h-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800"
                          : "h-fit rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                      }
                    >
                      {product.isActive ? "Active" : "Inactive"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="h-fit space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-950">Add product</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Codes may be entered manually or generated automatically.
            </p>
            <div className="mt-5">
              <ProductForm categories={activeCategories} />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-950">Categories</h2>
            <div className="mt-4">
              <ProductCategoryForm />
            </div>
            {categories.length > 0 ? (
              <ul className="mt-5 max-h-[32rem] space-y-4 overflow-y-auto overscroll-contain pr-2">
                {categories.map((category) => (
                  <li
                    className="space-y-3 rounded-xl border border-slate-200 p-3"
                    key={category.id}
                  >
                    {category.isActive ? (
                      <ProductCategoryForm category={category} />
                    ) : (
                      <p className="text-sm font-semibold text-slate-500">
                        {category.name} (inactive)
                      </p>
                    )}
                    {role === "admin" && category.isActive ? (
                      <ProductCategoryDeactivationForm
                        categoryId={category.id}
                        categoryName={category.name}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </aside>
      </div>

      <ProductCsvImport
        categories={activeCategories}
        requestId={randomUUID()}
      />
    </section>
  );
}
