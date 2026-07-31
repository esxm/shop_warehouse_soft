"use client";

import { useActionState, useState } from "react";

import {
  saveDailySalesDraftAction,
  type DailySalesActionState,
} from "@/app/(protected)/daily-sales/actions";
import {
  addMoney,
  formatRON,
  parseMoneyInput,
  type MoneyAmount,
} from "@/lib/money/money";
import type { BusinessDay } from "@/services/business-days";
import type { DailySales } from "@/services/daily-sales";

const initialState: DailySalesActionState = {};

function normalizedInput(value: string): string {
  try {
    return parseMoneyInput(value || "0");
  } catch {
    return value.trim();
  }
}

function calculateTotal(
  cashSalesRon: string,
  bankSalesRon: string,
  creditSalesRon: string,
): MoneyAmount | null {
  try {
    return addMoney(
      parseMoneyInput(cashSalesRon || "0"),
      parseMoneyInput(bankSalesRon || "0"),
      parseMoneyInput(creditSalesRon),
    );
  } catch {
    return null;
  }
}

export function DailySalesManager({
  openDay,
  draft,
  derivedCreditSalesRon,
}: Readonly<{
  openDay: BusinessDay;
  draft: DailySales | null;
  derivedCreditSalesRon: string;
}>) {
  const [saveState, saveAction, savePending] = useActionState(
    saveDailySalesDraftAction,
    initialState,
  );
  const initialCash = draft?.cashSalesRon ?? "0.00";
  const initialBank = draft?.bankSalesRon ?? "0.00";
  const initialNotes = draft?.notes ?? "";
  const [cashSalesRon, setCashSalesRon] = useState(initialCash);
  const [bankSalesRon, setBankSalesRon] = useState(initialBank);
  const [notes, setNotes] = useState(initialNotes);
  const total = calculateTotal(
    cashSalesRon,
    bankSalesRon,
    derivedCreditSalesRon,
  );
  const hasUnsavedChanges =
    normalizedInput(cashSalesRon) !== normalizedInput(initialCash) ||
    normalizedInput(bankSalesRon) !== normalizedInput(initialBank) ||
    notes.trim() !== initialNotes;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
          Automatically opened day
        </p>
        <h2 className="mt-2 text-2xl font-bold text-slate-950">
          {openDay.businessDate}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Credit sales are derived from customer credit purchases. At local
          midnight, the system closes this day using the last saved cash, bank,
          and notes draft.
        </p>
        <p className="mt-2 text-sm font-medium text-slate-700">
          {draft?.lastDraftByName
            ? `Last draft saved by ${draft.lastDraftByName}.`
            : "No employee has edited today’s automatic draft yet."}
        </p>

        <form action={saveAction} className="mt-6 space-y-5">
          <input name="businessDayId" type="hidden" value={openDay.id} />
          <input
            name="creditSalesRon"
            type="hidden"
            value={derivedCreditSalesRon}
          />

          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <label
                className="text-sm font-semibold text-slate-800"
                htmlFor="daily-cash-sales"
              >
                Cash sales (RON)
              </label>
              <input
                className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950"
                id="daily-cash-sales"
                inputMode="decimal"
                name="cashSalesRon"
                onChange={(event) => setCashSalesRon(event.target.value)}
                required
                value={cashSalesRon}
              />
              {saveState.errors?.cashSalesRon?.map((error) => (
                <p className="mt-2 text-sm text-red-700" key={error}>
                  {error}
                </p>
              ))}
            </div>

            <div>
              <label
                className="text-sm font-semibold text-slate-800"
                htmlFor="daily-bank-sales"
              >
                Bank sales (RON)
              </label>
              <input
                className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950"
                id="daily-bank-sales"
                inputMode="decimal"
                name="bankSalesRon"
                onChange={(event) => setBankSalesRon(event.target.value)}
                required
                value={bankSalesRon}
              />
              {saveState.errors?.bankSalesRon?.map((error) => (
                <p className="mt-2 text-sm text-red-700" key={error}>
                  {error}
                </p>
              ))}
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">
                Credit sales
              </p>
              <p className="mt-3 text-lg font-bold text-slate-950">
                {formatRON(parseMoneyInput(derivedCreditSalesRon))}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-teal-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
              Calculated total sales
            </p>
            <p className="mt-2 text-2xl font-bold text-teal-950">
              {total ? formatRON(total) : "Check cash and bank amounts"}
            </p>
          </div>

          <div>
            <label
              className="text-sm font-semibold text-slate-800"
              htmlFor="daily-sales-notes"
            >
              Notes
            </label>
            <textarea
              className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950"
              id="daily-sales-notes"
              maxLength={500}
              name="notes"
              onChange={(event) => setNotes(event.target.value)}
              value={notes}
            />
            {saveState.errors?.notes?.map((error) => (
              <p className="mt-2 text-sm text-red-700" key={error}>
                {error}
              </p>
            ))}
          </div>

          {saveState.message ? (
            <p className="text-sm font-medium text-red-700" role="alert">
              {saveState.message}
            </p>
          ) : null}

          {hasUnsavedChanges ? (
            <p className="rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-950">
              These changes are not part of the midnight close until you save
              the draft.
            </p>
          ) : null}

          <button
            className="w-full rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white disabled:opacity-60 sm:w-auto"
            disabled={savePending || total === null}
            type="submit"
          >
            {savePending ? "Saving…" : "Save draft"}
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-teal-200 bg-teal-50 p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-bold text-teal-950">
          Automatic midnight close
        </h2>
        <p className="mt-2 text-sm leading-6 text-teal-900">
          The last saved draft is closed automatically at the end of the
          business-local day. Cash and bank inflows are recorded once, current
          credit sales are derived, and the next day opens automatically.
        </p>
      </section>
    </div>
  );
}
