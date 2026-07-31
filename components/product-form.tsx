"use client";

import { useActionState, useState } from "react";

import {
  createProductAction,
  updateProductAction,
  type ProductActionState,
} from "@/app/(protected)/products/actions";
import type { Product, ProductCategory } from "@/services/products";

const initialState: ProductActionState = {};

export function ProductForm({
  categories,
  product,
}: Readonly<{
  categories: readonly ProductCategory[];
  product?: Product;
}>) {
  const isEditing = Boolean(product);
  const action = isEditing ? updateProductAction : createProductAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [purchaseCurrency, setPurchaseCurrency] = useState<"RON" | "USD">(
    product?.defaultPurchaseCurrency ?? "RON",
  );

  if (categories.length === 0) {
    return (
      <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
        Add an active product category before adding products.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      {product ? (
        <input name="productId" type="hidden" value={product.id} />
      ) : null}
      <div>
        <label
          className="text-sm font-semibold text-slate-800"
          htmlFor="product-code"
        >
          Internal code
        </label>
        <input
          autoCapitalize="characters"
          autoComplete="off"
          className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 font-mono uppercase text-slate-950"
          defaultValue={product?.internalCode ?? ""}
          id="product-code"
          maxLength={40}
          name="internalCode"
          placeholder={product ? undefined : "Leave blank to generate"}
          required={isEditing}
        />
        {!product ? (
          <p className="mt-2 text-xs text-slate-500">
            Blank codes are generated as P000001, P000002, and so on.
          </p>
        ) : null}
        {state.errors?.internalCode?.map((error) => (
          <p className="mt-2 text-sm text-red-700" key={error}>
            {error}
          </p>
        ))}
      </div>

      <div>
        <label
          className="text-sm font-semibold text-slate-800"
          htmlFor="product-name"
        >
          Product name
        </label>
        <input
          className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950"
          defaultValue={product?.name ?? ""}
          id="product-name"
          maxLength={160}
          name="name"
          required
        />
        {state.errors?.name?.map((error) => (
          <p className="mt-2 text-sm text-red-700" key={error}>
            {error}
          </p>
        ))}
      </div>

      <div>
        <label
          className="text-sm font-semibold text-slate-800"
          htmlFor="product-category"
        >
          Category
        </label>
        <select
          className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950"
          defaultValue={product?.categoryId ?? categories[0]?.id}
          id="product-category"
          name="categoryId"
          required
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {state.errors?.categoryId?.map((error) => (
          <p className="mt-2 text-sm text-red-700" key={error}>
            {error}
          </p>
        ))}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            className="text-sm font-semibold text-slate-800"
            htmlFor="product-purchase-cost"
          >
            Default purchase cost
          </label>
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
            <input
              className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950"
              defaultValue={product?.defaultPurchaseCostOriginal ?? ""}
              id="product-purchase-cost"
              inputMode="decimal"
              name="defaultPurchaseCostRon"
              placeholder="Optional"
            />
            <select
              aria-label="Default purchase cost currency"
              className="rounded-xl border border-slate-300 bg-white px-3 py-3 font-semibold text-slate-950"
              name="defaultPurchaseCurrency"
              onChange={(event) =>
                setPurchaseCurrency(event.target.value as "RON" | "USD")
              }
              value={purchaseCurrency}
            >
              <option value="RON">RON</option>
              <option value="USD">USD</option>
            </select>
          </div>
          {state.errors?.defaultPurchaseCostRon?.map((error) => (
            <p className="mt-2 text-sm text-red-700" key={error}>
              {error}
            </p>
          ))}
          {state.errors?.defaultPurchaseCurrency?.map((error) => (
            <p className="mt-2 text-sm text-red-700" key={error}>
              {error}
            </p>
          ))}
          {purchaseCurrency === "USD" ? (
            <div className="mt-4">
              <label
                className="text-sm font-semibold text-slate-800"
                htmlFor="product-purchase-rate"
              >
                Exchange rate (RON for 1 USD)
              </label>
              <input
                className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950"
                defaultValue={product?.defaultPurchaseExchangeRate ?? ""}
                id="product-purchase-rate"
                inputMode="decimal"
                name="defaultPurchaseExchangeRate"
                placeholder="Example: 4.61"
              />
              {state.errors?.defaultPurchaseExchangeRate?.map((error) => (
                <p className="mt-2 text-sm text-red-700" key={error}>
                  {error}
                </p>
              ))}
            </div>
          ) : (
            <input name="defaultPurchaseExchangeRate" type="hidden" value="" />
          )}
        </div>
        <div>
          <label
            className="text-sm font-semibold text-slate-800"
            htmlFor="product-selling-price"
          >
            Default selling price (RON)
          </label>
          <input
            className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950"
            defaultValue={product?.defaultSellingPriceRon ?? ""}
            id="product-selling-price"
            inputMode="decimal"
            name="defaultSellingPriceRon"
            placeholder="Optional"
          />
          {state.errors?.defaultSellingPriceRon?.map((error) => (
            <p className="mt-2 text-sm text-red-700" key={error}>
              {error}
            </p>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
        Unit: <strong className="text-slate-900">piece</strong>. Barcodes and
        quantities are not part of this step.
      </div>

      {state.message ? (
        <p className="text-sm font-medium text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}

      <button
        className="rounded-xl bg-slate-950 px-4 py-3 font-semibold text-white disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending
          ? isEditing
            ? "Saving..."
            : "Adding..."
          : isEditing
            ? "Save product"
            : "Add product"}
      </button>
    </form>
  );
}
