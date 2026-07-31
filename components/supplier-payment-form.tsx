"use client";

import { useActionState, useState } from "react";

import {
  createSupplierPaymentAction,
  type SupplierActionState,
} from "@/app/(protected)/suppliers/actions";
import type { MemberRole } from "@/lib/auth/types";
import type { BusinessDay } from "@/services/business-days";
import type { SupplierFinancialAccountOption } from "@/services/supplier-payments";

const initialState: SupplierActionState = {};

export type OutstandingSupplierPurchaseOption = Readonly<{
  id: string;
  purchaseDate: string;
  currency: "RON" | "USD";
  remainingOriginalAmount: string;
  purchaseExchangeRate: string | null;
  description: string | null;
}>;

type SupplierPaymentFormProps = Readonly<{
  supplierId: string;
  defaultCurrency: "RON" | "USD" | null;
  role: MemberRole;
  requestId: string;
  openDay: BusinessDay | null;
  businessDays: readonly BusinessDay[];
  accounts: readonly SupplierFinancialAccountOption[];
  outstandingPurchases: readonly OutstandingSupplierPurchaseOption[];
}>;

export function SupplierPaymentForm({
  supplierId,
  defaultCurrency,
  role,
  requestId,
  openDay,
  businessDays,
  accounts,
  outstandingPurchases,
}: SupplierPaymentFormProps) {
  const [state, formAction, pending] = useActionState(
    createSupplierPaymentAction,
    initialState,
  );
  const initialCurrency =
    defaultCurrency &&
    outstandingPurchases.some(
      (purchase) => purchase.currency === defaultCurrency,
    )
      ? defaultCurrency
      : (outstandingPurchases[0]?.currency ?? "RON");
  const [currency, setCurrency] = useState<"RON" | "USD">(initialCurrency);
  const [allocationStrategy, setAllocationStrategy] = useState<
    "oldest_first" | "manual"
  >("oldest_first");
  const [manualAmounts, setManualAmounts] = useState<Record<string, string>>(
    {},
  );
  const availableDays =
    role === "admin" ? businessDays : openDay ? [openDay] : [];
  const availableCurrencies = (["RON", "USD"] as const).filter((candidate) =>
    outstandingPurchases.some((purchase) => purchase.currency === candidate),
  );
  const currencyPurchases = outstandingPurchases.filter(
    (purchase) => purchase.currency === currency,
  );
  const manualAllocations =
    allocationStrategy === "manual"
      ? currencyPurchases.flatMap((purchase) => {
          const amountOriginal = manualAmounts[purchase.id]?.trim();

          return amountOriginal
            ? [{ purchaseId: purchase.id, amountOriginal }]
            : [];
        })
      : [];

  if (outstandingPurchases.length === 0) {
    return (
      <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
        This supplier has no outstanding purchases to pay.
      </p>
    );
  }

  if (availableDays.length === 0) {
    return (
      <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
        The automatic current business day is unavailable. Refresh before
        recording this payment.
      </p>
    );
  }

  if (accounts.length === 0) {
    return (
      <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
        No active RON cash or bank account is available.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <input name="supplierId" type="hidden" value={supplierId} />
      <input name="idempotencyKey" type="hidden" value={requestId} />
      <input
        name="allocationStrategy"
        type="hidden"
        value={allocationStrategy}
      />
      <input
        name="manualAllocations"
        type="hidden"
        value={JSON.stringify(manualAllocations)}
      />

      {role === "admin" ? (
        <div>
          <label
            className="text-sm font-semibold text-slate-800"
            htmlFor="supplier-payment-business-day"
          >
            Business day
          </label>
          <select
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950"
            defaultValue={openDay?.id ?? businessDays[0]?.id}
            id="supplier-payment-business-day"
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

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label
            className="text-sm font-semibold text-slate-800"
            htmlFor="supplier-payment-currency"
          >
            Payment currency
          </label>
          <select
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950"
            id="supplier-payment-currency"
            name="currency"
            onChange={(event) =>
              setCurrency(event.target.value === "USD" ? "USD" : "RON")
            }
            value={currency}
          >
            {availableCurrencies.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate}
              </option>
            ))}
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
            htmlFor="supplier-payment-amount"
          >
            Amount paid ({currency})
          </label>
          <input
            className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950"
            id="supplier-payment-amount"
            inputMode="decimal"
            name="originalAmountPaid"
            placeholder="0.00"
            required
          />
          {state.errors?.originalAmountPaid?.map((error) => (
            <p className="mt-2 text-sm text-red-700" key={error}>
              {error}
            </p>
          ))}
        </div>
      </div>

      {currency === "USD" ? (
        <div>
          <label
            className="text-sm font-semibold text-slate-800"
            htmlFor="supplier-payment-rate"
          >
            Payment-day USD/RON exchange rate
          </label>
          <input
            className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950"
            id="supplier-payment-rate"
            inputMode="decimal"
            name="paymentExchangeRate"
            placeholder="4.70000000"
            required
          />
          <p className="mt-2 text-xs text-slate-500">
            The account outflow uses this rate. Gain or loss is calculated
            against each purchase&apos;s historical rate.
          </p>
          {state.errors?.paymentExchangeRate?.map((error) => (
            <p className="mt-2 text-sm text-red-700" key={error}>
              {error}
            </p>
          ))}
        </div>
      ) : (
        <input name="paymentExchangeRate" type="hidden" value="" />
      )}

      <div>
        <label
          className="text-sm font-semibold text-slate-800"
          htmlFor="supplier-payment-account"
        >
          Payment account
        </label>
        <select
          className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950"
          id="supplier-payment-account"
          name="financialAccountId"
          required
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({account.type})
            </option>
          ))}
        </select>
        {state.errors?.financialAccountId?.map((error) => (
          <p className="mt-2 text-sm text-red-700" key={error}>
            {error}
          </p>
        ))}
      </div>

      <div>
        <label
          className="text-sm font-semibold text-slate-800"
          htmlFor="supplier-payment-notes"
        >
          Notes
        </label>
        <textarea
          className="mt-2 min-h-20 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950"
          id="supplier-payment-notes"
          maxLength={500}
          name="notes"
        />
        {state.errors?.notes?.map((error) => (
          <p className="mt-2 text-sm text-red-700" key={error}>
            {error}
          </p>
        ))}
      </div>

      <fieldset className="rounded-2xl border border-slate-200 p-4">
        <legend className="px-2 text-sm font-semibold text-slate-800">
          Allocation method
        </legend>
        <label className="flex gap-3 text-sm text-slate-700">
          <input
            checked={allocationStrategy === "oldest_first"}
            name="supplier-allocation-choice"
            onChange={() => setAllocationStrategy("oldest_first")}
            type="radio"
          />
          Apply to the oldest outstanding {currency} purchases first
        </label>
        <label className="mt-3 flex gap-3 text-sm text-slate-700">
          <input
            checked={allocationStrategy === "manual"}
            name="supplier-allocation-choice"
            onChange={() => setAllocationStrategy("manual")}
            type="radio"
          />
          Allocate payment manually
        </label>

        {allocationStrategy === "manual" ? (
          <div className="mt-4 space-y-3">
            {currencyPurchases.map((purchase) => (
              <div
                className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_10rem]"
                key={purchase.id}
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {purchase.purchaseDate}
                  </p>
                  <p className="text-xs text-slate-500">
                    Remaining: {purchase.remainingOriginalAmount}{" "}
                    {purchase.currency}
                  </p>
                  {purchase.purchaseExchangeRate ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Purchase rate: {purchase.purchaseExchangeRate} RON
                    </p>
                  ) : null}
                  {purchase.description ? (
                    <p className="mt-1 text-xs text-slate-500">
                      {purchase.description}
                    </p>
                  ) : null}
                </div>
                <label className="text-xs font-semibold text-slate-700">
                  Allocate {currency}
                  <input
                    aria-label={`Allocate to supplier purchase from ${purchase.purchaseDate}`}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950"
                    inputMode="decimal"
                    onChange={(event) =>
                      setManualAmounts((current) => ({
                        ...current,
                        [purchase.id]: event.target.value,
                      }))
                    }
                    value={manualAmounts[purchase.id] ?? ""}
                  />
                </label>
              </div>
            ))}
          </div>
        ) : null}
        {state.errors?.manualAllocations?.map((error) => (
          <p className="mt-2 text-sm text-red-700" key={error}>
            {error}
          </p>
        ))}
        {state.errors?.allocationStrategy?.map((error) => (
          <p className="mt-2 text-sm text-red-700" key={error}>
            {error}
          </p>
        ))}
      </fieldset>

      {role === "admin" ? (
        <div>
          <label
            className="text-sm font-semibold text-slate-800"
            htmlFor="supplier-payment-audit-reason"
          >
            Historical audit reason
          </label>
          <textarea
            className="mt-2 min-h-20 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950"
            id="supplier-payment-audit-reason"
            maxLength={500}
            minLength={10}
            name="auditReason"
            placeholder="Required only for a closed historical day."
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
        className="rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Recording..." : "Record supplier payment"}
      </button>
    </form>
  );
}
