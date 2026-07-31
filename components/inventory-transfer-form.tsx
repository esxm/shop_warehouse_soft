"use client";

import { useActionState, useRef, useState } from "react";

import {
  createInventoryTransferAction,
  type InventoryTransferActionState,
} from "@/app/(protected)/inventory-value/actions";
import type { MemberRole } from "@/lib/auth/types";
import type { BusinessDay } from "@/services/business-days";
import type {
  InventoryLocationBalance,
  InventoryTransferProductOption,
} from "@/services/inventory-value";

const initialState: InventoryTransferActionState = {};

type DraftLine = {
  key: number;
  productId: string;
  quantity: string;
};

export function InventoryTransferForm({
  role,
  requestId,
  openDay,
  businessDays,
  locations,
  products,
}: Readonly<{
  role: MemberRole;
  requestId: string;
  openDay: BusinessDay | null;
  businessDays: readonly BusinessDay[];
  locations: readonly InventoryLocationBalance[];
  products: readonly InventoryTransferProductOption[];
}>) {
  const [state, formAction, pending] = useActionState(
    createInventoryTransferAction,
    initialState,
  );
  const [lines, setLines] = useState<DraftLine[]>([
    {
      key: 0,
      productId: products[0]?.id ?? "",
      quantity: "",
    },
  ]);
  const nextLineKey = useRef(1);
  const warehouse = locations.find((location) => location.type === "warehouse");
  const shop = locations.find((location) => location.type === "shop");
  const availableDays =
    role === "admin" ? businessDays : openDay ? [openDay] : [];

  function updateLine(
    key: number,
    field: "productId" | "quantity",
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
        recording a transfer.
      </p>
    );
  }

  if (!warehouse || !shop) {
    return (
      <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
        Both a warehouse and shop inventory location are required.
      </p>
    );
  }

  if (products.length === 0) {
    return (
      <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
        No product currently has a positive warehouse quantity.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <input name="idempotencyKey" type="hidden" value={requestId} />
      <input name="sourceLocationId" type="hidden" value={warehouse.id} />
      <input name="destinationLocationId" type="hidden" value={shop.id} />
      <input
        name="lines"
        type="hidden"
        value={JSON.stringify(
          lines.map(({ productId, quantity }) => ({
            productId,
            quantity,
          })),
        )}
      />

      {role === "admin" ? (
        <div>
          <label
            className="text-sm font-semibold text-slate-800"
            htmlFor="inventory-transfer-business-day"
          >
            Transfer date
          </label>
          <select
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
            defaultValue={openDay?.id ?? businessDays[0]?.id}
            id="inventory-transfer-business-day"
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
          <p className="text-sm text-slate-500">Transfer date</p>
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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Source warehouse
          </p>
          <p className="mt-1 font-bold text-slate-950">{warehouse.name}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Destination shop
          </p>
          <p className="mt-1 font-bold text-slate-950">{shop.name}</p>
        </div>
      </div>

      <fieldset className="space-y-4 rounded-2xl border border-slate-200 p-4">
        <legend className="px-2 text-sm font-bold text-slate-900">
          Products to transfer
        </legend>
        {lines.map((line, index) => {
          const selected = products.find(
            (product) => product.id === line.productId,
          );
          return (
            <div
              className="grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-[minmax(0,1fr)_10rem_auto]"
              key={line.key}
            >
              <div>
                <label
                  className="text-xs font-semibold text-slate-700"
                  htmlFor={`inventory-transfer-product-${line.key}`}
                >
                  Product {index + 1}
                </label>
                <select
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950"
                  id={`inventory-transfer-product-${line.key}`}
                  onChange={(event) =>
                    updateLine(line.key, "productId", event.target.value)
                  }
                  value={line.productId}
                >
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.internalCode} · {product.name} ·{" "}
                      {product.warehouseQuantity} available
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  className="text-xs font-semibold text-slate-700"
                  htmlFor={`inventory-transfer-quantity-${line.key}`}
                >
                  Quantity
                </label>
                <input
                  className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950"
                  id={`inventory-transfer-quantity-${line.key}`}
                  inputMode="numeric"
                  max={selected?.warehouseQuantity}
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

      <div>
        <label
          className="text-sm font-semibold text-slate-800"
          htmlFor="inventory-transfer-notes"
        >
          Notes
        </label>
        <textarea
          className="mt-2 min-h-20 w-full rounded-xl border border-slate-300 px-4 py-3"
          id="inventory-transfer-notes"
          maxLength={500}
          name="notes"
        />
        {state.errors?.notes?.map((error) => (
          <p className="mt-2 text-sm text-red-700" key={error}>
            {error}
          </p>
        ))}
      </div>

      {role === "admin" ? (
        <div>
          <label
            className="text-sm font-semibold text-slate-800"
            htmlFor="inventory-transfer-audit-reason"
          >
            Historical audit reason
          </label>
          <textarea
            className="mt-2 min-h-20 w-full rounded-xl border border-slate-300 px-4 py-3"
            id="inventory-transfer-audit-reason"
            maxLength={500}
            minLength={10}
            name="auditReason"
            placeholder="Required only when the selected day is closed."
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
        {pending ? "Transferring..." : "Transfer products to shop"}
      </button>
    </form>
  );
}
