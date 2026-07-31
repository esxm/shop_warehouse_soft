"use client";

import { useActionState, useState } from "react";

import {
  importProductsAction,
  type ProductActionState,
} from "@/app/(protected)/products/actions";
import {
  buildProductCsvPreview,
  createProductCsvTemplate,
  type ProductCsvPreview,
  type ProductImportCategory,
} from "@/lib/products/csv";

const initialState: ProductActionState = {};
const emptyPreview: ProductCsvPreview = { rows: [], errors: [] };

export function ProductCsvImport({
  categories,
  requestId,
}: Readonly<{
  categories: readonly ProductImportCategory[];
  requestId: string;
}>) {
  const [state, formAction, pending] = useActionState(
    importProductsAction,
    initialState,
  );
  const [preview, setPreview] = useState<ProductCsvPreview>(emptyPreview);
  const validRows = preview.rows.flatMap((row) =>
    row.resolved ? [row.resolved] : [],
  );
  const canImport =
    preview.rows.length > 0 &&
    validRows.length === preview.rows.length &&
    preview.errors.length === 0;
  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(
    createProductCsvTemplate(),
  )}`;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
            Bulk setup
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">
            Import products from CSV
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Categories must already exist. Leave internal_code blank to generate
            one. The preview must be error-free before the batch can be
            imported.
          </p>
        </div>
        <a
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          download="product-import-template.csv"
          href={templateHref}
        >
          Download template
        </a>
      </div>

      <div className="mt-5">
        <label
          className="text-sm font-semibold text-slate-800"
          htmlFor="product-csv-file"
        >
          CSV file
        </label>
        <input
          accept=".csv,text/csv"
          className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
          id="product-csv-file"
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (!file) {
              setPreview(emptyPreview);
              return;
            }

            void file.text().then((csv) => {
              setPreview(buildProductCsvPreview(csv, categories));
            });
          }}
          type="file"
        />
      </div>

      {preview.errors.map((error) => (
        <p
          className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800"
          key={error}
          role="alert"
        >
          {error}
        </p>
      ))}

      {preview.rows.length > 0 ? (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-3xl border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-3 py-2 font-semibold">Row</th>
                <th className="px-3 py-2 font-semibold">Code</th>
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Category</th>
                <th className="px-3 py-2 font-semibold">Purchase</th>
                <th className="px-3 py-2 font-semibold">Selling</th>
                <th className="px-3 py-2 font-semibold">Validation</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.slice(0, 100).map((row) => (
                <tr className="border-b border-slate-100" key={row.rowNumber}>
                  <td className="px-3 py-3">{row.rowNumber}</td>
                  <td className="px-3 py-3 font-mono">
                    {row.internalCode ?? "Generated"}
                  </td>
                  <td className="px-3 py-3">{row.name}</td>
                  <td className="px-3 py-3">{row.category}</td>
                  <td className="px-3 py-3">
                    {row.defaultPurchaseCostRon ?? "—"}
                  </td>
                  <td className="px-3 py-3">
                    {row.defaultSellingPriceRon ?? "—"}
                  </td>
                  <td
                    className={
                      row.errors.length === 0
                        ? "px-3 py-3 text-emerald-700"
                        : "px-3 py-3 text-red-700"
                    }
                  >
                    {row.errors.length === 0 ? "Ready" : row.errors.join(" ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.rows.length > 100 ? (
            <p className="mt-3 text-xs text-slate-500">
              Showing the first 100 of {preview.rows.length} validated rows.
            </p>
          ) : null}
        </div>
      ) : null}

      <form action={formAction} className="mt-5">
        <input name="idempotencyKey" type="hidden" value={requestId} />
        <input name="rows" type="hidden" value={JSON.stringify(validRows)} />
        {state.message ? (
          <p className="mb-3 text-sm font-medium text-red-700" role="alert">
            {state.message}
          </p>
        ) : null}
        <button
          className="w-full rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          disabled={pending || !canImport}
          type="submit"
        >
          {pending
            ? "Importing..."
            : canImport
              ? `Import ${validRows.length} products`
              : "Resolve preview errors"}
        </button>
      </form>
    </section>
  );
}
