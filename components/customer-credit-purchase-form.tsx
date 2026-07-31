"use client";

import Decimal from "decimal.js";
import { useActionState, useRef, useState } from "react";

import {
  createCustomerCreditPurchaseAction,
  type CustomerActionState,
} from "@/app/(protected)/customers/actions";
import type { MemberRole } from "@/lib/auth/types";
import type { BusinessDay } from "@/services/business-days";
import type { ProductSaleOption } from "@/services/product-sales";

const initialState: CustomerActionState = {};

type DraftLine = {
  key: number;
  productId: string;
  quantity: string;
  unitSellingPriceOriginalCurrency: string;
};

type CustomerCreditPurchaseFormProps = Readonly<{
  customerId: string;
  requestId: string;
  role: MemberRole;
  openDay: BusinessDay | null;
  businessDays: readonly BusinessDay[];
  products: readonly ProductSaleOption[];
}>;

function parseDecimal(value: string): Decimal {
  try {
    const parsed = new Decimal(value.replace(",", "."));
    return parsed.isFinite() ? parsed : new Decimal(0);
  } catch {
    return new Decimal(0);
  }
}

export function CustomerCreditPurchaseForm({
  customerId,
  requestId,
  role,
  openDay,
  businessDays,
  products,
}: CustomerCreditPurchaseFormProps) {
  const [state, formAction, pending] = useActionState(
    createCustomerCreditPurchaseAction,
    initialState,
  );
  const [currency, setCurrency] = useState<"RON" | "USD">("RON");
  const [exchangeRate, setExchangeRate] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([
    {
      key: 0,
      productId: products[0]?.id ?? "",
      quantity: "",
      unitSellingPriceOriginalCurrency: "",
    },
  ]);
  const nextLineKey = useRef(1);
  const availableDays =
    role === "admin" ? businessDays : openDay ? [openDay] : [];
  const shopLocationId = products[0]?.shopLocationId ?? "";
  const shopLocationName = products[0]?.shopLocationName ?? "Shop";
  const rate = parseDecimal(exchangeRate);
  const originalTotal = lines.reduce((total, line) => {
    return total.plus(
      parseDecimal(line.quantity).times(
        parseDecimal(line.unitSellingPriceOriginalCurrency),
      ),
    );
  }, new Decimal(0));
  const ronTotal =
    currency === "USD" && rate.greaterThan(0)
      ? originalTotal.times(rate)
      : originalTotal;

  function updateLine(
    key: number,
    field: "productId" | "quantity" | "unitSellingPriceOriginalCurrency",
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
        quantity: "",
        unitSellingPriceOriginalCurrency: "",
      },
    ]);
  }

  function removeLine(key: number) {
    setLines((current) => current.filter((line) => line.key !== key));
  }

  if (availableDays.length === 0) {
    return (
      <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
        The automatic current business day is unavailable. Refresh before
        recording a credit purchase.
      </p>
    );
  }

  if (products.length === 0) {
    return (
      <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
        No shop product currently has positive quantity and a complete
        historical buying cost.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <input name="customerId" type="hidden" value={customerId} />
      <input name="idempotencyKey" type="hidden" value={requestId} />
      <input name="shopLocationId" type="hidden" value={shopLocationId} />
      <input
        name="lines"
        type="hidden"
        value={JSON.stringify(
          lines.map(
            ({ productId, quantity, unitSellingPriceOriginalCurrency }) => ({
              productId,
              quantity,
              unitSellingPriceOriginalCurrency,
            }),
          ),
        )}
      />

      {role === "admin" ? (
        <div>
          <label
            className="text-sm font-semibold text-slate-800"
            htmlFor="credit-business-day"
          >
            Business day
          </label>
          <select
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950"
            defaultValue={openDay?.id ?? businessDays[0]?.id}
            id="credit-business-day"
            name="businessDayId"
            required
          >
            {businessDays.map((day) => (
              <option key={day.id} value={day.id}>
                {day.businessDate} ({day.status})
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="rounded-xl bg-slate-50 p-4">
          <input name="businessDayId" type="hidden" value={openDay?.id} />
          <p className="text-sm text-slate-500">Current business day</p>
          <p className="mt-1 font-bold text-slate-950">
            {openDay?.businessDate}
          </p>
        </div>
      )}
      {state.errors?.businessDayId?.map((error) => (
        <p className="text-sm text-red-700" key={error}>
          {error}
        </p>
      ))}

      <div className="rounded-xl bg-slate-50 p-4">
        <p className="text-sm text-slate-500">Stock source</p>
        <p className="mt-1 font-bold text-slate-950">{shopLocationName}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            className="text-sm font-semibold text-slate-800"
            htmlFor="credit-currency"
          >
            Selling currency
          </label>
          <select
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950"
            id="credit-currency"
            name="currency"
            onChange={(event) =>
              setCurrency(event.target.value === "USD" ? "USD" : "RON")
            }
            value={currency}
          >
            <option value="RON">RON</option>
            <option value="USD">USD</option>
          </select>
          {state.errors?.currency?.map((error) => (
            <p className="mt-2 text-sm text-red-700" key={error}>
              {error}
            </p>
          ))}
        </div>
        <div>
          <label
            className="text-sm font-semibold text-slate-800"
            htmlFor="credit-exchange-rate"
          >
            USD/RON exchange rate
          </label>
          <input
            className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950"
            id="credit-exchange-rate"
            inputMode="decimal"
            name="exchangeRate"
            onChange={(event) => setExchangeRate(event.target.value)}
            placeholder="4.60000000"
            required
            value={exchangeRate}
          />
          {state.errors?.exchangeRate?.map((error) => (
            <p className="mt-2 text-sm text-red-700" key={error}>
              {error}
            </p>
          ))}
        </div>
      </div>

      <fieldset className="space-y-4 rounded-2xl border border-slate-200 p-4">
        <legend className="px-2 text-sm font-bold text-slate-900">
          Products sold on credit
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
                  htmlFor={`credit-product-${line.key}`}
                >
                  Product {index + 1}
                </label>
                <select
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950"
                  id={`credit-product-${line.key}`}
                  onChange={(event) =>
                    updateLine(line.key, "productId", event.target.value)
                  }
                  value={line.productId}
                >
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.internalCode} - {product.name} -{" "}
                      {product.shopQuantity} available
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  className="text-xs font-semibold text-slate-700"
                  htmlFor={`credit-quantity-${line.key}`}
                >
                  Quantity
                </label>
                <input
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950"
                  id={`credit-quantity-${line.key}`}
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
                  htmlFor={`credit-price-${line.key}`}
                >
                  Price ({currency})
                </label>
                <input
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950"
                  id={`credit-price-${line.key}`}
                  inputMode="decimal"
                  min="0.01"
                  onChange={(event) =>
                    updateLine(
                      line.key,
                      "unitSellingPriceOriginalCurrency",
                      event.target.value,
                    )
                  }
                  placeholder="0.00"
                  required
                  step="0.01"
                  type="number"
                  value={line.unitSellingPriceOriginalCurrency}
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
        <div className="rounded-xl bg-teal-50 p-4">
          <p className="text-xs font-semibold uppercase text-teal-700">
            Credit total ({currency})
          </p>
          <p className="mt-2 text-xl font-bold text-teal-950">
            {originalTotal.toFixed(2)} {currency}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">
            Receivable stored in RON
          </p>
          <p className="mt-2 text-xl font-bold text-slate-950">
            {ronTotal.toFixed(2)} RON
          </p>
        </div>
      </div>

      <div>
        <label
          className="text-sm font-semibold text-slate-800"
          htmlFor="credit-description"
        >
          Description
        </label>
        <textarea
          className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950"
          id="credit-description"
          maxLength={500}
          name="description"
        />
        {state.errors?.description?.map((error) => (
          <p className="mt-2 text-sm text-red-700" key={error}>
            {error}
          </p>
        ))}
      </div>

      <div>
        <label
          className="text-sm font-semibold text-slate-800"
          htmlFor="credit-due-date"
        >
          Due date
        </label>
        <input
          className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950"
          id="credit-due-date"
          name="dueDate"
          type="date"
        />
        {state.errors?.dueDate?.map((error) => (
          <p className="mt-2 text-sm text-red-700" key={error}>
            {error}
          </p>
        ))}
      </div>

      <input name="auditReason" type="hidden" value="" />

      {state.message ? (
        <p className="text-sm font-medium text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}

      <button
        className="w-full rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white disabled:opacity-60 sm:w-auto"
        disabled={pending}
        type="submit"
      >
        {pending ? "Recording..." : "Record product credit purchase"}
      </button>
    </form>
  );
}
