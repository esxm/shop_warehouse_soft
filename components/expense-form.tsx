"use client";

import { useActionState } from "react";

import {
  createExpenseAction,
  type ExpenseActionState,
} from "@/app/(protected)/expenses/actions";
import type { MemberRole } from "@/lib/auth/types";
import type { BusinessDay } from "@/services/business-days";
import type {
  ExpenseCategory,
  ExpenseFinancialAccount,
} from "@/services/expenses";

const initialState: ExpenseActionState = {};

export function ExpenseForm({
  role,
  requestId,
  openDay,
  businessDays,
  categories,
  accounts,
}: Readonly<{
  role: MemberRole;
  requestId: string;
  openDay: BusinessDay | null;
  businessDays: readonly BusinessDay[];
  categories: readonly ExpenseCategory[];
  accounts: readonly ExpenseFinancialAccount[];
}>) {
  const [state, formAction, pending] = useActionState(
    createExpenseAction,
    initialState,
  );
  const availableDays =
    role === "admin" ? businessDays : openDay ? [openDay] : [];

  if (availableDays.length === 0) {
    return (
      <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
        The automatic current business day is unavailable. Refresh before
        recording an expense.
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
      <input name="idempotencyKey" type="hidden" value={requestId} />

      {role === "admin" ? (
        <div>
          <label
            className="text-sm font-semibold text-slate-800"
            htmlFor="expense-business-day"
          >
            Business day
          </label>
          <select
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
            defaultValue={openDay?.id ?? businessDays[0]?.id}
            id="expense-business-day"
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
            htmlFor="expense-category"
          >
            Category
          </label>
          <select
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
            id="expense-category"
            name="categoryId"
            required
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            className="text-sm font-semibold text-slate-800"
            htmlFor="expense-amount"
          >
            Amount (RON)
          </label>
          <input
            className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3"
            id="expense-amount"
            inputMode="decimal"
            name="amountRon"
            placeholder="0.00"
            required
          />
        </div>
      </div>
      {state.errors?.categoryId?.map((error) => (
        <p className="text-sm text-red-700" key={error}>
          {error}
        </p>
      ))}
      {state.errors?.amountRon?.map((error) => (
        <p className="text-sm text-red-700" key={error}>
          {error}
        </p>
      ))}

      <div>
        <label
          className="text-sm font-semibold text-slate-800"
          htmlFor="expense-account"
        >
          Paid from
        </label>
        <select
          className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
          id="expense-account"
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
          htmlFor="expense-description"
        >
          Description
        </label>
        <textarea
          className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 px-4 py-3"
          id="expense-description"
          maxLength={500}
          name="description"
          required
        />
        {state.errors?.description?.map((error) => (
          <p className="mt-2 text-sm text-red-700" key={error}>
            {error}
          </p>
        ))}
      </div>

      {role === "admin" ? (
        <div>
          <label
            className="text-sm font-semibold text-slate-800"
            htmlFor="expense-audit-reason"
          >
            Historical audit reason
          </label>
          <textarea
            className="mt-2 min-h-20 w-full rounded-xl border border-slate-300 px-4 py-3"
            id="expense-audit-reason"
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
        {pending ? "Recording..." : "Record expense"}
      </button>
    </form>
  );
}
