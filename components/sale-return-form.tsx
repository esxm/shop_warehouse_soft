"use client";

import Decimal from "decimal.js";
import { useActionState, useState } from "react";

import {
  createSaleReturnAction,
  type ReturnsAndLossesActionState,
} from "@/app/(protected)/returns-and-losses/actions";
import type { BusinessDay } from "@/services/business-days";
import type { ReturnableSale } from "@/services/returns-and-losses";

const initialState: ReturnsAndLossesActionState = {};

function decimal(value: string): Decimal {
  try {
    const parsed = new Decimal(value.replace(",", "."));
    return parsed.isFinite() ? parsed : new Decimal(0);
  } catch {
    return new Decimal(0);
  }
}

export function SaleReturnForm({
  openDay,
  sales,
  requestId,
}: Readonly<{
  openDay: BusinessDay;
  sales: readonly ReturnableSale[];
  requestId: string;
}>) {
  const [state, formAction, pending] = useActionState(
    createSaleReturnAction,
    initialState,
  );
  const [saleId, setSaleId] = useState(sales[0]?.id ?? "");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [dispositions, setDispositions] = useState<
    Record<string, "sellable" | "damaged">
  >({});
  const [cash, setCash] = useState("0.00");
  const [bank, setBank] = useState("0.00");
  const [credit, setCredit] = useState("0.00");
  const sale = sales.find((item) => item.id === saleId) ?? sales[0];
  const lines =
    sale?.lines.flatMap((line) => {
      const quantity = quantities[line.id] ?? "";
      return decimal(quantity).greaterThan(0)
        ? [
            {
              saleLineId: line.id,
              quantity,
              disposition: dispositions[line.id] ?? "sellable",
            },
          ]
        : [];
    }) ?? [];
  const totals = sale?.lines.reduce(
    (total, line) => {
      const quantity = decimal(quantities[line.id] ?? "0");
      return {
        refund: total.refund.plus(quantity.times(line.unitSellingPriceRon)),
        cost: total.cost.plus(quantity.times(line.unitCostRon)),
      };
    },
    { refund: new Decimal(0), cost: new Decimal(0) },
  ) ?? { refund: new Decimal(0), cost: new Decimal(0) };
  const split = decimal(cash).plus(bank).plus(credit);
  const splitMatches =
    split.equals(totals.refund) && totals.refund.greaterThan(0);

  if (sales.length === 0) {
    return (
      <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
        No active sale has unreturned product quantities.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <input name="businessDayId" type="hidden" value={openDay.id} />
      <input name="idempotencyKey" type="hidden" value={requestId} />
      <input name="lines" type="hidden" value={JSON.stringify(lines)} />

      <label className="block text-sm font-semibold text-slate-800">
        Original sale
        <select
          className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
          name="saleId"
          onChange={(event) => {
            setSaleId(event.target.value);
            setQuantities({});
            setDispositions({});
            setCash("0.00");
            setBank("0.00");
            setCredit("0.00");
          }}
          value={sale?.id}
        >
          {sales.map((item) => (
            <option key={item.id} value={item.id}>
              Sale #{item.saleNumber} · {item.saleDate}
              {item.customerName ? ` · ${item.customerName}` : ""}
            </option>
          ))}
        </select>
      </label>

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full min-w-[46rem] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3 text-right">Available</th>
              <th className="px-4 py-3 text-right">Refund / piece</th>
              <th className="px-4 py-3">Return quantity</th>
              <th className="px-4 py-3">Condition</th>
            </tr>
          </thead>
          <tbody>
            {sale?.lines.map((line) => (
              <tr className="border-t border-slate-200" key={line.id}>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-teal-800">
                    {line.productCode}
                  </span>
                  <span className="ml-2 font-semibold">{line.productName}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  {line.returnableQuantity}
                </td>
                <td className="px-4 py-3 text-right">
                  {line.unitSellingPriceRon} RON
                </td>
                <td className="px-4 py-3">
                  <input
                    className="w-28 rounded-lg border border-slate-300 px-3 py-2"
                    max={line.returnableQuantity}
                    min="0"
                    onChange={(event) =>
                      setQuantities((current) => ({
                        ...current,
                        [line.id]: event.target.value,
                      }))
                    }
                    step="1"
                    type="number"
                    value={quantities[line.id] ?? ""}
                  />
                </td>
                <td className="px-4 py-3">
                  <select
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2"
                    onChange={(event) =>
                      setDispositions((current) => ({
                        ...current,
                        [line.id]: event.target.value as "sellable" | "damaged",
                      }))
                    }
                    value={dispositions[line.id] ?? "sellable"}
                  >
                    <option value="sellable">Sellable stock</option>
                    <option value="damaged">Damaged stock</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {state.errors?.lines?.map((error) => (
        <p className="text-sm text-red-700" key={error}>
          {error}
        </p>
      ))}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">
            Refund at original prices
          </p>
          <p className="mt-2 text-xl font-bold">
            {totals.refund.toFixed(2)} RON
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">
            Historical returned cost
          </p>
          <p className="mt-2 text-xl font-bold">{totals.cost.toFixed(2)} RON</p>
        </div>
      </div>

      <fieldset className="rounded-2xl border border-slate-200 p-4">
        <legend className="px-2 text-sm font-bold">Refund method</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-semibold">
            Cash refund (RON)
            <input
              className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3"
              name="cashRefundRon"
              onChange={(event) => setCash(event.target.value)}
              required
              value={cash}
            />
          </label>
          <label className="text-sm font-semibold">
            Bank refund (RON)
            <input
              className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3"
              name="bankRefundRon"
              onChange={(event) => setBank(event.target.value)}
              required
              value={bank}
            />
          </label>
          <label className="text-sm font-semibold">
            Cancel customer credit (RON)
            <input
              className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3"
              max={sale?.creditAvailableRon}
              name="creditReductionRon"
              onChange={(event) => setCredit(event.target.value)}
              required
              value={credit}
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Available: {sale?.creditAvailableRon ?? "0.00"} RON
            </span>
          </label>
        </div>
        <button
          className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
          onClick={() => {
            setCash(totals.refund.toFixed(2));
            setBank("0.00");
            setCredit("0.00");
          }}
          type="button"
        >
          Set full refund to cash
        </button>
        <p
          className={
            splitMatches
              ? "mt-3 text-sm font-semibold text-emerald-700"
              : "mt-3 text-sm font-semibold text-red-700"
          }
        >
          {splitMatches
            ? "Refund split matches returned products."
            : `Difference: ${totals.refund.minus(split).toFixed(2)} RON`}
        </p>
      </fieldset>

      <label className="block text-sm font-semibold">
        Required reason
        <textarea
          className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 px-4 py-3"
          maxLength={500}
          minLength={10}
          name="reason"
          required
        />
      </label>
      {state.errors?.reason?.map((error) => (
        <p className="text-sm text-red-700" key={error}>
          {error}
        </p>
      ))}
      {state.message ? (
        <p className="text-sm font-medium text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}
      <button
        className="w-full rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white disabled:opacity-50 sm:w-auto"
        disabled={pending || !splitMatches || lines.length === 0}
        type="submit"
      >
        {pending ? "Recording..." : "Record customer return"}
      </button>
    </form>
  );
}
