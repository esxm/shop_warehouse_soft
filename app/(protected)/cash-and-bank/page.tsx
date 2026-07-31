import { CollapsiblePanel } from "@/components/collapsible-panel";
import {
  redirectEmployeeToDailySales,
  requireBusinessMember,
} from "@/lib/auth/session";
import {
  formatInstantInBusinessTimeZone,
  getTodayInBusinessTimeZone,
} from "@/lib/date/business-date";
import { addMoney, formatRON, parseMoneyInput } from "@/lib/money/money";
import {
  financialAccountLedgerFilterSchema,
  type FinancialAccountLedgerFilter,
} from "@/lib/validation/financial-account-ledger";
import {
  getFinancialAccountBalances,
  getFinancialAccountDailyTotals,
  getFinancialAccountEntries,
} from "@/services/financial-account-ledger";

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function entryTypeLabel(value: string) {
  return value.replaceAll("_", " ");
}

export default async function CashAndBankPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const context = await requireBusinessMember();
  redirectEmployeeToDailySales(context);
  const query = await searchParams;
  const requestedFromDate = firstValue(query.fromDate);
  const requestedToDate = firstValue(query.toDate);
  const defaultHistoryDate = getTodayInBusinessTimeZone(
    context.business.timezone,
  );
  const useDefaultHistoryDate = !requestedFromDate && !requestedToDate;
  const rawFilter = {
    accountId: firstValue(query.accountId),
    fromDate: useDefaultHistoryDate ? defaultHistoryDate : requestedFromDate,
    toDate: useDefaultHistoryDate ? defaultHistoryDate : requestedToDate,
  };
  const filterResult = financialAccountLedgerFilterSchema.safeParse(rawFilter);
  const filter: FinancialAccountLedgerFilter = filterResult.success
    ? filterResult.data
    : {
        accountId: null,
        fromDate: null,
        toDate: null,
      };
  const [balances, dailyTotals, entries] = await Promise.all([
    getFinancialAccountBalances(context),
    getFinancialAccountDailyTotals(context, filter),
    getFinancialAccountEntries(context, filter),
  ]);
  const combinedBalance = addMoney(
    ...balances.map((account) => parseMoneyInput(account.balanceRon)),
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="grid gap-4 sm:grid-cols-3">
          {balances.map((account) => (
            <article className="rounded-2xl bg-slate-50 p-5" key={account.id}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {account.type}
              </p>
              <h2 className="mt-2 font-bold text-slate-950">{account.name}</h2>
              <p className="mt-3 text-xl font-bold text-teal-900">
                {formatRON(parseMoneyInput(account.balanceRon))}
              </p>
            </article>
          ))}
          <article className="rounded-2xl bg-teal-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
              Combined balance
            </p>
            <p className="mt-7 text-xl font-bold text-teal-950">
              {formatRON(combinedBalance)}
            </p>
          </article>
        </div>
      </section>

      <CollapsiblePanel title="Ledger filters">
        <form
          className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto]"
          method="get"
        >
          <label className="text-sm font-semibold text-slate-800">
            Account
            <select
              className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950"
              defaultValue={rawFilter.accountId}
              name="accountId"
            >
              <option value="">All accounts</option>
              {balances.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.type})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-800">
            From date
            <input
              className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950"
              defaultValue={rawFilter.fromDate}
              name="fromDate"
              type="date"
            />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            To date
            <input
              className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950"
              defaultValue={rawFilter.toDate}
              name="toDate"
              type="date"
            />
          </label>
          <button
            className="self-end rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white"
            type="submit"
          >
            Apply
          </button>
        </form>
        {!filterResult.success ? (
          <p
            className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            {filterResult.error.issues[0]?.message ??
              "Check the ledger filters."}
          </p>
        ) : null}
      </CollapsiblePanel>

      <CollapsiblePanel title="Daily totals">
        {dailyTotals.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
            No daily account movements match these filters.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Account</th>
                  <th className="px-3 py-3 text-right">Inflows</th>
                  <th className="px-3 py-3 text-right">Outflows</th>
                  <th className="px-3 py-3 text-right">Net</th>
                  <th className="px-3 py-3 text-right">Entries</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dailyTotals.map((total) => (
                  <tr key={`${total.financialAccountId}-${total.entryDate}`}>
                    <td className="px-3 py-3 font-semibold text-slate-900">
                      {total.entryDate}
                    </td>
                    <td className="px-3 py-3 text-slate-700">
                      {total.financialAccountName}
                    </td>
                    <td className="px-3 py-3 text-right text-emerald-800">
                      {formatRON(parseMoneyInput(total.inflowRon))}
                    </td>
                    <td className="px-3 py-3 text-right text-red-800">
                      {formatRON(parseMoneyInput(total.outflowRon))}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-900">
                      {formatRON(parseMoneyInput(total.netMovementRon))}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-600">
                      {total.entryCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CollapsiblePanel>

      <CollapsiblePanel
        description="Up to 200 newest matching entries."
        title="Transaction history"
      >
        <p className="mt-2 text-sm text-slate-600">
          Showing up to 200 newest matching entries.
        </p>
        {entries.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
            No account entries match these filters.
          </p>
        ) : (
          <ul className="mt-5 max-h-[38rem] space-y-3 overflow-y-auto overscroll-contain pr-2">
            {entries.map((entry) => (
              <li
                className="rounded-2xl border border-slate-200 p-5"
                key={entry.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-bold capitalize text-slate-950">
                      {entryTypeLabel(entry.entryType)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {entry.entryDate} · {entry.financialAccountName}
                    </p>
                    {entry.description ? (
                      <p className="mt-2 text-sm text-slate-700">
                        {entry.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p
                      className={
                        entry.direction === "inflow"
                          ? "font-bold text-emerald-800"
                          : "font-bold text-red-800"
                      }
                    >
                      {entry.direction === "inflow" ? "+" : "−"}
                      {formatRON(parseMoneyInput(entry.amountRon))}
                    </p>
                    {entry.reversalOfId ? (
                      <span className="mt-2 inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
                        Reversal
                      </span>
                    ) : null}
                  </div>
                </div>
                <dl className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold text-slate-700">Source</dt>
                    <dd className="mt-1 break-all">
                      {entry.sourceEntityType}: {entry.sourceEntityId}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-700">Recorded</dt>
                    <dd className="mt-1">
                      {formatInstantInBusinessTimeZone(
                        entry.createdAt,
                        context.business.timezone,
                      )}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </CollapsiblePanel>
    </div>
  );
}
