import { randomUUID } from "node:crypto";

import { CollapsiblePanel } from "@/components/collapsible-panel";
import { ExpenseForm } from "@/components/expense-form";
import { ExpenseReversalForm } from "@/components/expense-reversal-form";
import { HistoryPeriodFilter } from "@/components/history-period-filter";
import {
  redirectEmployeeToDailySales,
  requireBusinessMember,
} from "@/lib/auth/session";
import { formatInstantInBusinessTimeZone } from "@/lib/date/business-date";
import { resolveHistoryPeriod } from "@/lib/date/history-date";
import { formatRON, parseMoneyInput } from "@/lib/money/money";
import { getBusinessDays, getOpenBusinessDay } from "@/services/business-days";
import { getExpensePageData } from "@/services/expenses";

const successMessages: Readonly<Record<string, string>> = {
  created: "Expense recorded and deducted from the selected account.",
  reversed: "Expense reversed and the account balance restored.",
};

export default async function ExpensesPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const context = await requireBusinessMember();
  redirectEmployeeToDailySales(context);
  const query = await searchParams;
  const historyPeriod = resolveHistoryPeriod(query, context.business.timezone);
  const [openDay, businessDays, pageData] = await Promise.all([
    getOpenBusinessDay(context.business.id),
    getBusinessDays(context, 1000),
    getExpensePageData(context, historyPeriod),
  ]);
  const resultKey = Object.keys(successMessages).find(
    (key) => query[key] === "1",
  );

  return (
    <div className="space-y-6">
      {resultKey ? (
        <p
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-950"
          role="status"
        >
          {successMessages[resultKey]}
        </p>
      ) : null}

      <CollapsiblePanel title="Record expense">
        <div className="mt-5">
          <ExpenseForm
            accounts={pageData.accounts}
            businessDays={businessDays}
            categories={pageData.categories}
            openDay={openDay}
            requestId={randomUUID()}
            role={context.role}
          />
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel title="Monthly category totals">
        {pageData.monthlySummaries.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            No active expenses exist yet.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-3 py-3">Month</th>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3">Entries</th>
                  <th className="px-3 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {pageData.monthlySummaries.map((summary) => (
                  <tr
                    className="border-b border-slate-100"
                    key={`${summary.monthStart}-${summary.categoryName}`}
                  >
                    <td className="px-3 py-3">{summary.monthStart}</td>
                    <td className="px-3 py-3 font-medium">
                      {summary.categoryName}
                    </td>
                    <td className="px-3 py-3">{summary.expenseCount}</td>
                    <td className="px-3 py-3 text-right font-bold">
                      {formatRON(parseMoneyInput(summary.totalRon))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CollapsiblePanel>

      <CollapsiblePanel
        description={`Expenses from ${historyPeriod.fromDate} to ${historyPeriod.toDate}.`}
        id="expense-history"
        title="Expense history"
      >
        <HistoryPeriodFilter
          action="/expenses"
          anchor="expense-history"
          error={historyPeriod.error}
          fromDate={historyPeriod.fromDate}
          toDate={historyPeriod.toDate}
        />
        {pageData.expenses.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
            No expenses were recorded from {historyPeriod.fromDate} to{" "}
            {historyPeriod.toDate}.
          </p>
        ) : (
          <ul className="mt-5 max-h-[38rem] space-y-3 overflow-y-auto overscroll-contain pr-2">
            {pageData.expenses.map((expense) => (
              <li
                className="scroll-mt-6 rounded-2xl border border-slate-200 p-5"
                id={`expense-${expense.id}`}
                key={expense.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-bold text-slate-950">
                      {expense.categoryName}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {expense.description}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {expense.expenseDate} · {expense.financialAccountName} (
                      {expense.financialAccountType}) ·{" "}
                      {formatInstantInBusinessTimeZone(
                        expense.createdAt,
                        context.business.timezone,
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={
                        expense.status === "active"
                          ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800"
                          : "rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                      }
                    >
                      {expense.status}
                    </span>
                    <p className="mt-2 text-lg font-bold text-slate-950">
                      {formatRON(parseMoneyInput(expense.amountRon))}
                    </p>
                  </div>
                </div>
                {expense.status === "reversed" && expense.reversalReason ? (
                  <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                    Reversal: {expense.reversalReason}
                  </p>
                ) : null}
                {context.role === "admin" && expense.status === "active" ? (
                  <ExpenseReversalForm expenseId={expense.id} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CollapsiblePanel>
    </div>
  );
}
