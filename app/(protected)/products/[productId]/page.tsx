import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductDeactivationForm } from "@/components/product-deactivation-form";
import { ProductForm } from "@/components/product-form";
import {
  redirectEmployeeToDailySales,
  requireBusinessMember,
} from "@/lib/auth/session";
import { formatRON, formatUSD, parseMoneyInput } from "@/lib/money/money";
import { productIdSchema } from "@/lib/validation/products";
import { getProduct, getProductCategories } from "@/services/products";

export default async function ProductDetailsPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ productId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const context = await requireBusinessMember();
  redirectEmployeeToDailySales(context);
  const [{ productId: rawProductId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const idResult = productIdSchema.safeParse(rawProductId);

  if (!idResult.success) {
    notFound();
  }

  const [product, categories] = await Promise.all([
    getProduct(context, idResult.data),
    getProductCategories(context),
  ]);

  if (!product) {
    notFound();
  }

  const successMessage =
    query.created === "1"
      ? "Product created."
      : query.updated === "1"
        ? "Product updated."
        : query.deactivated === "1"
          ? "Product deactivated."
          : null;

  return (
    <div className="space-y-6">
      <Link
        className="inline-flex text-sm font-semibold text-teal-700 hover:text-teal-900"
        href="/stock#products"
      >
        ← Back to products and stock
      </Link>

      {successMessage ? (
        <p
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-950"
          role="status"
        >
          {successMessage}
        </p>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-sm font-semibold text-teal-700">
              {product.internalCode}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              {product.name}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {product.categoryName} · sold by piece
            </p>
          </div>
          <span
            className={
              product.isActive
                ? "rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800"
                : "rounded-full bg-slate-200 px-3 py-1 text-sm font-semibold text-slate-700"
            }
          >
            {product.isActive ? "Active" : "Inactive"}
          </span>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-xs font-semibold uppercase text-slate-500">
              Default purchase cost
            </dt>
            <dd className="mt-1 font-bold text-slate-950">
              {product.defaultPurchaseCostOriginal
                ? product.defaultPurchaseCurrency === "USD"
                  ? formatUSD(
                      parseMoneyInput(product.defaultPurchaseCostOriginal),
                    )
                  : formatRON(
                      parseMoneyInput(product.defaultPurchaseCostOriginal),
                    )
                : "Not set"}
            </dd>
            {product.defaultPurchaseCurrency === "USD" &&
            product.defaultPurchaseExchangeRate &&
            product.defaultPurchaseCostRon ? (
              <dd className="mt-1 text-xs text-slate-500">
                1 USD = {product.defaultPurchaseExchangeRate} RON ·{" "}
                {formatRON(parseMoneyInput(product.defaultPurchaseCostRon))}
              </dd>
            ) : null}
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-xs font-semibold uppercase text-slate-500">
              Default selling price
            </dt>
            <dd className="mt-1 font-bold text-slate-950">
              {product.defaultSellingPriceRon
                ? formatRON(parseMoneyInput(product.defaultSellingPriceRon))
                : "Not set"}
            </dd>
          </div>
        </dl>

        {product.isActive ? (
          <div className="mt-8 max-w-2xl">
            <h2 className="text-xl font-bold text-slate-950">
              Edit product metadata
            </h2>
            <div className="mt-5">
              <ProductForm categories={categories} product={product} />
            </div>
          </div>
        ) : (
          <p className="mt-8 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Inactive product metadata is preserved and cannot be edited.
          </p>
        )}
      </section>

      {context.role === "admin" && product.isActive ? (
        <ProductDeactivationForm productId={product.id} />
      ) : null}
    </div>
  );
}
