"use client";

import Decimal from "decimal.js";
import { useActionState, useRef, useState } from "react";

import {
  createProductSaleAction,
  type ProductSaleActionState,
} from "@/app/(protected)/daily-sales/actions";
import type { Customer } from "@/services/customers";
import type { BusinessDay } from "@/services/business-days";
import type { ProductSaleOption } from "@/services/product-sales";

const initialState: ProductSaleActionState = {};

type DraftLine = {
  key: number;
  productId: string;
  quantity: string;
  unitSellingPriceRon: string;
};

function parseDecimal(value: string): Decimal {
  try {
    const parsed = new Decimal(value.replace(",", "."));
    return parsed.isFinite() ? parsed : new Decimal(0);
  } catch {
    return new Decimal(0);
  }
}

export function ProductSaleForm({
  openDay,
  products,
  customers,
  requestId,
}: Readonly<{
  openDay: BusinessDay;
  products: readonly ProductSaleOption[];
  customers: readonly Customer[];
  requestId: string;
}>) {
  const [state, formAction, pending] = useActionState(
    createProductSaleAction,
    initialState,
  );
  const [lines, setLines] = useState<DraftLine[]>([
    {
      key: 0,
      productId: products[0]?.id ?? "",
      quantity: "1",
      unitSellingPriceRon: "",
    },
  ]);
  const [cashAmount, setCashAmount] = useState("0.00");
  const [bankAmount, setBankAmount] = useState("0.00");
  const [creditAmount, setCreditAmount] = useState("0.00");
  const [autoCashPayment, setAutoCashPayment] = useState(true);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const nextLineKey = useRef(1);
  const shopLocationId = products[0]?.shopLocationId ?? "";

  const estimate = lines.reduce(
    (totals, line) => {
      const product = products.find((option) => option.id === line.productId);
      const quantity = parseDecimal(line.quantity);
      const sellingPrice = parseDecimal(line.unitSellingPriceRon);
      const unitCost = parseDecimal(product?.averageUnitCostRon ?? "0");
      return {
        revenue: totals.revenue.plus(quantity.times(sellingPrice)),
        cost: totals.cost.plus(quantity.times(unitCost)),
      };
    },
    { revenue: new Decimal(0), cost: new Decimal(0) },
  );
  const estimatedProfit = estimate.revenue.minus(estimate.cost);
  const estimatedProfitPercent = estimate.cost.greaterThan(0)
    ? estimatedProfit.dividedBy(estimate.cost).times(100)
    : new Decimal(0);
  const saleTotalRon = estimate.revenue.toFixed(2);
  const effectiveCashAmount = autoCashPayment ? saleTotalRon : cashAmount;
  const effectiveBankAmount = autoCashPayment ? "0.00" : bankAmount;
  const effectiveCreditAmount = autoCashPayment ? "0.00" : creditAmount;
  const paymentTotal = parseDecimal(effectiveCashAmount)
    .plus(parseDecimal(effectiveBankAmount))
    .plus(parseDecimal(effectiveCreditAmount));
  const paymentDifference = estimate.revenue.minus(paymentTotal);
  const paymentMatches = paymentDifference.abs().lessThan("0.005");
  const hasCredit = parseDecimal(effectiveCreditAmount).greaterThan(0);

  function updateLine(
    key: number,
    field: "productId" | "quantity" | "unitSellingPriceRon",
    value: string,
  ) {
    setLines((current) =>
      current.map((line) =>
        line.key === key ? { ...line, [field]: value } : line,
      ),
    );
  }

  function addLine() {
    const key = nextLineKey.current;
    nextLineKey.current += 1;
    setLines((current) => [
      ...current,
      {
        key,
        productId: products[0]?.id ?? "",
        quantity: "1",
        unitSellingPriceRon: "",
      },
    ]);
  }

  function removeLine(key: number) {
    setLines((current) => current.filter((line) => line.key !== key));
  }

  function updatePayment(setter: (value: string) => void, value: string): void {
    setAutoCashPayment(false);
    setter(value);
  }

  if (products.length === 0) {
    return (
      <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
        No shop product currently has both positive quantity and a complete
        historical buying cost.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <input name="businessDayId" type="hidden" value={openDay.id} />
      <input name="shopLocationId" type="hidden" value={shopLocationId} />
      <input name="idempotencyKey" type="hidden" value={requestId} />
      <input
        name="lines"
        type="hidden"
        value={JSON.stringify(
          lines.map(({ productId, quantity, unitSellingPriceRon }) => ({
            productId,
            quantity,
            unitSellingPriceRon,
          })),
        )}
      />

      <fieldset className="space-y-4 rounded-2xl border border-slate-200 p-4">
        <legend className="px-2 text-sm font-bold text-slate-900">
          Products sold
        </legend>
        {lines.map((line, index) => {
          const selected = products.find(
            (product) => product.id === line.productId,
          );
          return (
            <div
              className="grid gap-3 rounded-xl bg-slate-50 p-4 lg:grid-cols-[minmax(0,1fr)_8rem_10rem_auto]"
              key={line.key}
            >
              <div>
                <label
                  className="text-xs font-semibold text-slate-700"
                  htmlFor={`sale-product-${line.key}`}
                >
                  Product {index + 1}
                </label>
                <select
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950"
                  id={`sale-product-${line.key}`}
                  onChange={(event) =>
                    updateLine(line.key, "productId", event.target.value)
                  }
                  value={line.productId}
                >
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.internalCode} · {product.name} ·{" "}
                      {product.shopQuantity} available · cost{" "}
                      {new Decimal(product.averageUnitCostRon).toFixed(2)} RON
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  className="text-xs font-semibold text-slate-700"
                  htmlFor={`sale-quantity-${line.key}`}
                >
                  Quantity
                </label>
                <input
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950"
                  id={`sale-quantity-${line.key}`}
                  inputMode="numeric"
                  max={selected?.shopQuantity}
                  min="1"
                  onChange={(event) =>
                    updateLine(line.key, "quantity", event.target.value)
                  }
                  required
                  step="1"
                  type="number"
                  value={line.quantity}
                />
              </div>
              <div>
                <label
                  className="text-xs font-semibold text-slate-700"
                  htmlFor={`sale-price-${line.key}`}
                >
                  Selling price (RON)
                </label>
                <input
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950"
                  id={`sale-price-${line.key}`}
                  inputMode="decimal"
                  min="0.01"
                  onChange={(event) =>
                    updateLine(
                      line.key,
                      "unitSellingPriceRon",
                      event.target.value,
                    )
                  }
                  placeholder="0.00"
                  required
                  step="0.01"
                  type="number"
                  value={line.unitSellingPriceRon}
                />
              </div>
              <button
                className="self-end rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={lines.length === 1}
                onClick={() => removeLine(line.key)}
                type="button"
              >
                Remove
              </button>
            </div>
          );
        })}
        <button
          className="rounded-lg border border-teal-200 px-3 py-2 text-sm font-semibold text-teal-800 disabled:opacity-40"
          disabled={lines.length >= 100}
          onClick={addLine}
          type="button"
        >
          Add product line
        </button>
        {state.errors?.lines?.map((error) => (
          <p className="text-sm text-red-700" key={error}>
            {error}
          </p>
        ))}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-4 sm:max-w-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sale total
          </p>
          <p className="mt-2 text-xl font-bold text-slate-950">
            {saleTotalRon} RON
          </p>
        </div>
        <div className="hidden rounded-xl bg-teal-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
            Estimated profit
          </p>
          <p className="mt-2 text-xl font-bold text-teal-950">
            {estimatedProfit.toFixed(2)} RON ·{" "}
            {estimatedProfitPercent.toFixed(2)}%
          </p>
          <p className="mt-1 text-xs text-teal-800">
            Profit percentage on cost
          </p>
        </div>
      </div>

      <button
        aria-expanded={showMoreOptions}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800"
        onClick={() =>
          setShowMoreOptions((current) => {
            if (current) {
              setAutoCashPayment(true);
              setCashAmount(saleTotalRon);
              setBankAmount("0.00");
              setCreditAmount("0.00");
            }

            return !current;
          })
        }
        type="button"
      >
        {showMoreOptions ? "Hide options" : "More options"}
      </button>

      {showMoreOptions ? (
        <div className="space-y-5 rounded-2xl border border-slate-200 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Estimated cost
              </p>
              <p className="mt-2 text-xl font-bold text-slate-950">
                {estimate.cost.toFixed(2)} RON
              </p>
            </div>
            <div className="rounded-xl bg-teal-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                Estimated profit
              </p>
              <p className="mt-2 text-xl font-bold text-teal-950">
                {estimatedProfit.toFixed(2)} RON /{" "}
                {estimatedProfitPercent.toFixed(2)}%
              </p>
              <p className="mt-1 text-xs text-teal-800">
                Profit percentage on cost
              </p>
            </div>
          </div>

          <fieldset className="rounded-2xl border border-slate-200 p-4">
            <legend className="text-sm font-bold text-slate-900">
              Payment split
            </legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="text-sm font-semibold text-slate-800">
                Cash (RON)
                <input
                  className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3"
                  inputMode="decimal"
                  name="cashAmountRon"
                  onChange={(event) =>
                    updatePayment(setCashAmount, event.target.value)
                  }
                  required
                  value={effectiveCashAmount}
                />
              </label>
              <label className="text-sm font-semibold text-slate-800">
                Bank (RON)
                <input
                  className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3"
                  inputMode="decimal"
                  name="bankAmountRon"
                  onChange={(event) =>
                    updatePayment(setBankAmount, event.target.value)
                  }
                  required
                  value={effectiveBankAmount}
                />
              </label>
              <label className="text-sm font-semibold text-slate-800">
                Customer credit (RON)
                <input
                  className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3"
                  inputMode="decimal"
                  name="creditAmountRon"
                  onChange={(event) =>
                    updatePayment(setCreditAmount, event.target.value)
                  }
                  required
                  value={effectiveCreditAmount}
                />
              </label>
            </div>
            <button
              className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800"
              onClick={() => {
                setAutoCashPayment(true);
                setCashAmount(estimate.revenue.toFixed(2));
                setBankAmount("0.00");
                setCreditAmount("0.00");
              }}
              type="button"
            >
              Set full sale to cash
            </button>
            <p
              className={
                paymentMatches
                  ? "mt-3 text-sm font-semibold text-emerald-700"
                  : "mt-3 text-sm font-semibold text-red-700"
              }
            >
              {paymentMatches
                ? "Payment split matches the sale."
                : `Payment difference: ${paymentDifference.toFixed(2)} RON`}
            </p>
            {state.errors?.cashAmountRon?.map((error) => (
              <p className="mt-2 text-sm text-red-700" key={error}>
                {error}
              </p>
            ))}
          </fieldset>

          {hasCredit ? (
            <div>
              <label
                className="text-sm font-semibold text-slate-800"
                htmlFor="product-sale-customer"
              >
                Credit customer
              </label>
              <select
                className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
                defaultValue=""
                id="product-sale-customer"
                name="customerId"
                required
              >
                <option disabled value="">
                  Select customer
                </option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
              {state.errors?.customerId?.map((error) => (
                <p className="mt-2 text-sm text-red-700" key={error}>
                  {error}
                </p>
              ))}
            </div>
          ) : (
            <input name="customerId" type="hidden" value="" />
          )}

          <div>
            <label
              className="text-sm font-semibold text-slate-800"
              htmlFor="product-sale-notes"
            >
              Notes
            </label>
            <textarea
              className="mt-2 min-h-20 w-full rounded-xl border border-slate-300 px-4 py-3"
              id="product-sale-notes"
              maxLength={500}
              name="notes"
            />
          </div>
        </div>
      ) : (
        <>
          <input
            name="cashAmountRon"
            type="hidden"
            value={effectiveCashAmount}
          />
          <input
            name="bankAmountRon"
            type="hidden"
            value={effectiveBankAmount}
          />
          <input
            name="creditAmountRon"
            type="hidden"
            value={effectiveCreditAmount}
          />
          <input name="customerId" type="hidden" value="" />
          <input name="notes" type="hidden" value="" />
        </>
      )}

      {state.message ? (
        <p className="text-sm font-medium text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}
      <button
        className="w-full rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        disabled={pending || !paymentMatches}
        type="submit"
      >
        {pending ? "Recording sale…" : "Record individual sale"}
      </button>
    </form>
  );
}
