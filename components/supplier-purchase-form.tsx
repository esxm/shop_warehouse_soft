"use client";

import { useActionState, useRef, useState } from "react";

import {
  createSupplierPurchaseAction,
  type SupplierActionState,
} from "@/app/(protected)/suppliers/actions";
import type { MemberRole } from "@/lib/auth/types";
import type { BusinessDay } from "@/services/business-days";
import type { Product } from "@/services/products";
import type { InventoryLocationOption } from "@/services/supplier-purchases";

const initialState: SupplierActionState = {};

type DraftLine = {
  key: number;
  productId: string;
  quantity: string;
  unitPriceOriginalCurrency: string;
};

type SupplierPurchaseFormProps = Readonly<{
  supplierId: string;
  requestId: string;
  defaultCurrency: "RON" | "USD" | null;
  role: MemberRole;
  openDay: BusinessDay | null;
  businessDays: readonly BusinessDay[];
  locations: readonly InventoryLocationOption[];
  products: readonly Product[];
}>;

export function SupplierPurchaseForm({
  supplierId,
  requestId,
  defaultCurrency,
  role,
  openDay,
  businessDays,
  locations,
  products,
}: SupplierPurchaseFormProps) {
  const [state, formAction, pending] = useActionState(
    createSupplierPurchaseAction,
    initialState,
  );
  const [currency, setCurrency] = useState<"RON" | "USD">(
    defaultCurrency ?? "RON",
  );
  const [lines, setLines] = useState<DraftLine[]>([
    {
      key: 0,
      productId: products[0]?.id ?? "",
      quantity: "",
      unitPriceOriginalCurrency: "",
    },
  ]);
  const nextLineKey = useRef(1);
  const availableDays =
    role === "admin" ? businessDays : openDay ? [openDay] : [];
  const estimatedOriginalTotal = lines.reduce((total, line) => {
    const quantity = Number(line.quantity);
    const unitPrice = Number(line.unitPriceOriginalCurrency.replace(",", "."));
    return Number.isFinite(quantity) && Number.isFinite(unitPrice)
      ? total + quantity * unitPrice
      : total;
  }, 0);

  function updateLine(
    key: number,
    field: "productId" | "quantity" | "unitPriceOriginalCurrency",
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
        unitPriceOriginalCurrency: "",
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
        recording a supplier purchase.
      </p>
    );
  }

  if (locations.length === 0) {
    return (
      <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
        No active inventory destination is available.
      </p>
    );
  }

  if (products.length === 0) {
    return (
      <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
        Add an active product before receiving supplier goods.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <input name="supplierId" type="hidden" value={supplierId} />
      <input name="idempotencyKey" type="hidden" value={requestId} />
      <input
        name="lines"
        type="hidden"
        value={JSON.stringify(
          lines.map(({ productId, quantity, unitPriceOriginalCurrency }) => ({
            productId,
            quantity,
            unitPriceOriginalCurrency,
          })),
        )}
      />

      {role === "admin" ? (
        <div>
          <label
            className="text-sm font-semibold text-slate-800"
            htmlFor="supplier-purchase-business-day"
          >
            Business day
          </label>
          <select
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950"
            defaultValue={openDay?.id ?? businessDays[0]?.id}
            id="supplier-purchase-business-day"
            name="businessDayId"
            required
          >
            {businessDays.map((day) => (
              <option key={day.id} value={day.id}>
                {day.businessDate} ({day.status})
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-500">
            Closed historical days require an audit reason.
          </p>
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

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            className="text-sm font-semibold text-slate-800"
            htmlFor="supplier-purchase-currency"
          >
            Currency
          </label>
          <select
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950"
            id="supplier-purchase-currency"
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
            htmlFor="supplier-purchase-destination"
          >
            Inventory destination
          </label>
          <select
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950"
            defaultValue={locations[0]?.id}
            id="supplier-purchase-destination"
            name="destinationLocationId"
            required
          >
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name} ({location.type})
              </option>
            ))}
          </select>
          {state.errors?.destinationLocationId?.map((error) => (
            <p className="mt-2 text-sm text-red-700" key={error}>
              {error}
            </p>
          ))}
        </div>
      </div>

      <div>
        <label
          className="text-sm font-semibold text-slate-800"
          htmlFor="supplier-purchase-rate"
        >
          Historical USD/RON exchange rate
        </label>
        <input
          className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950"
          id="supplier-purchase-rate"
          inputMode="decimal"
          name="purchaseExchangeRate"
          placeholder="4.60000000"
          required
        />
        <p className="mt-2 text-xs text-slate-500">
          Enter how many RON equal 1 USD for this purchase. The system stores
          both RON and USD historical costs.
        </p>
        {state.errors?.purchaseExchangeRate?.map((error) => (
          <p className="mt-2 text-sm text-red-700" key={error}>
            {error}
          </p>
        ))}
      </div>

      <fieldset className="space-y-4 rounded-2xl border border-slate-200 p-4">
        <legend className="px-2 text-sm font-bold text-slate-900">
          Products received
        </legend>
        {lines.map((line, index) => (
          <div
            className="grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-[minmax(0,1fr)_8rem_10rem_auto]"
            key={line.key}
          >
            <div>
              <label
                className="text-xs font-semibold text-slate-700"
                htmlFor={`supplier-purchase-product-${line.key}`}
              >
                Product {index + 1}
              </label>
              <select
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950"
                id={`supplier-purchase-product-${line.key}`}
                onChange={(event) =>
                  updateLine(line.key, "productId", event.target.value)
                }
                value={line.productId}
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.internalCode} · {product.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                className="text-xs font-semibold text-slate-700"
                htmlFor={`supplier-purchase-quantity-${line.key}`}
              >
                Quantity
              </label>
              <input
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950"
                id={`supplier-purchase-quantity-${line.key}`}
                inputMode="numeric"
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
                htmlFor={`supplier-purchase-price-${line.key}`}
              >
                Unit price ({currency})
              </label>
              <input
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950"
                id={`supplier-purchase-price-${line.key}`}
                inputMode="decimal"
                min="0.01"
                onChange={(event) =>
                  updateLine(
                    line.key,
                    "unitPriceOriginalCurrency",
                    event.target.value,
                  )
                }
                placeholder="0.00"
                required
                step="0.01"
                type="number"
                value={line.unitPriceOriginalCurrency}
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
        ))}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            className="rounded-lg border border-teal-200 px-3 py-2 text-sm font-semibold text-teal-800 disabled:opacity-40"
            disabled={lines.length >= 100}
            onClick={addLine}
            type="button"
          >
            Add product line
          </button>
          <p className="text-sm font-bold text-slate-900">
            Estimated total:{" "}
            {estimatedOriginalTotal.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            {currency}
          </p>
        </div>
        {state.errors?.lines?.map((error) => (
          <p className="text-sm text-red-700" key={error}>
            {error}
          </p>
        ))}
      </fieldset>

      <div>
        <label
          className="text-sm font-semibold text-slate-800"
          htmlFor="supplier-purchase-description"
        >
          Description
        </label>
        <textarea
          className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950"
          id="supplier-purchase-description"
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
          htmlFor="supplier-purchase-due-date"
        >
          Due date
        </label>
        <input
          className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950"
          id="supplier-purchase-due-date"
          name="dueDate"
          type="date"
        />
        {state.errors?.dueDate?.map((error) => (
          <p className="mt-2 text-sm text-red-700" key={error}>
            {error}
          </p>
        ))}
      </div>

      {role === "admin" ? (
        <div>
          <label
            className="text-sm font-semibold text-slate-800"
            htmlFor="supplier-purchase-audit-reason"
          >
            Historical audit reason
          </label>
          <textarea
            className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950"
            id="supplier-purchase-audit-reason"
            maxLength={500}
            minLength={10}
            name="auditReason"
            placeholder="Required only when using a closed historical day."
          />
          {state.errors?.auditReason?.map((error) => (
            <p className="mt-2 text-sm text-red-700" key={error}>
              {error}
            </p>
          ))}
        </div>
      ) : (
        <input name="auditReason" type="hidden" value="" />
      )}

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
        {pending ? "Recording..." : "Receive products and create payable"}
      </button>
    </form>
  );
}
