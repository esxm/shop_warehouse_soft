import Link from "next/link";

import { ReportNavigation } from "@/components/report-navigation";
import {
  redirectEmployeeToDailySales,
  requireBusinessMember,
} from "@/lib/auth/session";
import { formatInstantInBusinessTimeZone } from "@/lib/date/business-date";
import { formatRON } from "@/lib/money/money";
import {
  cashBankReportFilterSchema,
  type CashBankReportFilter,
} from "@/lib/reports/cash-bank";
import { getCashBankReportPageData } from "@/services/cash-bank-report";

function firstQueryValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function typeLabel(value: string): string {
  return value.replaceAll("_", " ");
}

export default async function CashBankReportPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const context = await requireBusinessMember();
  redirectEmployeeToDailySales(context);
  const query = await searchParams;
  const filterResult = cashBankReportFilterSchema.safeParse({
    accountId: firstQueryValue(query.accountId),
    fromDate: firstQueryValue(query.fromDate),
    toDate: firstQueryValue(query.toDate),
    entryType: firstQueryValue(query.entryType),
  });
  const defaultFilter = cashBankReportFilterSchema.parse({});
  const filter: CashBankReportFilter = filterResult.success
    ? filterResult.data
    : defaultFilter;
  const { accounts, report } = await getCashBankReportPageData(context, filter);
  const exportQuery = new URLSearchParams();

  if (filter.accountId) {
    exportQuery.set("accountId", filter.accountId);
  }
  if (filter.fromDate) {
    exportQuery.set("fromDate", filter.fromDate);
  }
  if (filter.toDate) {
    exportQuery.set("toDate", filter.toDate);
  }
  if (filter.entryType) {
    exportQuery.set("entryType", filter.entryType);
  }

  return (
    <div className="space-y-6">
      <ReportNavigation />

      <div className="flex justify-end">
        <a
          className="inline-flex w-fit rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white"
          href={`/reports/cash-and-bank.csv?${exportQuery.toString()}`}
        >
          Export CSV
        </a>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-bold text-slate-950">Filters</h2>
        <form
          className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]"
          method="get"
        >
          <label className="text-sm font-semibold text-slate-800">
            Account
            <select
              className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              defaultValue={filter.accountId ?? ""}
              name="accountId"
            >
              <option value="">Cash and bank</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.type})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-800">
            From date
            <input
              className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3"
              defaultValue={filter.fromDate ?? ""}
              name="fromDate"
              type="date"
            />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            To date
            <input
              className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3"
              defaultValue={filter.toDate ?? ""}
              name="toDate"
              type="date"
            />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Transaction type
            <select
              className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 capitalize"
              defaultValue={filter.entryType ?? ""}
              name="entryType"
            >
              <option value="">All transaction types</option>
              {report.transactionTypes.map((entryType) => (
                <option key={entryType} value={entryType}>
                  {typeLabel(entryType)}
                </option>
              ))}
            </select>
          </label>
          <button
            className="w-full self-end rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white sm:w-auto"
            type="submit"
          >
            Apply filters
          </button>
        </form>
        {!filterResult.success ? (
          <p
            className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            {filterResult.error.issues[0]?.message ??
              "Check the account report filters."}{" "}
            Showing the unfiltered ledger.
          </p>
        ) : null}
        <p className="mt-4 text-xs leading-5 text-slate-500">
          A transaction-type filter hides unrelated rows and totals, but each
          visible running balance still includes every account movement.
        </p>
      </section>

      {report.accounts.map((account) => (
        <section className="space-y-4" key={account.accountId}>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
                  {account.accountType}
                </p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">
                  {account.accountName}
                </h2>
              </div>
              <Link
                className="text-sm font-semibold text-teal-700 hover:text-teal-900"
                href="/reports/cash-and-bank"
              >
                Clear filters
              </Link>
            </div>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl bg-slate-50 p-4">
                <dt className="text-xs font-semibold uppercase text-slate-500">
                  Opening balance
                </dt>
                <dd className="mt-2 text-lg font-bold">
                  {formatRON(account.openingBalanceRon)}
                </dd>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4">
                <dt className="text-xs font-semibold uppercase text-emerald-700">
                  Selected inflows
                </dt>
                <dd className="mt-2 text-lg font-bold text-emerald-950">
                  {formatRON(account.totalInflowsRon)}
                </dd>
              </div>
              <div className="rounded-2xl bg-red-50 p-4">
                <dt className="text-xs font-semibold uppercase text-red-700">
                  Selected outflows
                </dt>
                <dd className="mt-2 text-lg font-bold text-red-950">
                  {formatRON(account.totalOutflowsRon)}
                </dd>
              </div>
              <div className="rounded-2xl bg-slate-100 p-4">
                <dt className="text-xs font-semibold uppercase text-slate-600">
                  Period ending
                </dt>
                <dd className="mt-2 text-lg font-bold">
                  {formatRON(account.periodEndingBalanceRon)}
                </dd>
              </div>
              <div className="rounded-2xl bg-teal-50 p-4">
                <dt className="text-xs font-semibold uppercase text-teal-700">
                  Current balance
                </dt>
                <dd className="mt-2 text-lg font-bold text-teal-950">
                  {formatRON(account.currentBalanceRon)}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h3 className="text-xl font-bold text-slate-950">
              Transaction ledger
            </h3>
            {account.rows.length === 0 ? (
              <p className="mt-4 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
                No transactions match these filters.
              </p>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <caption className="sr-only">
                    {account.accountName} transaction ledger
                  </caption>
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-3">Date</th>
                      <th className="px-3 py-3">Type and description</th>
                      <th className="px-3 py-3 text-right">Inflow</th>
                      <th className="px-3 py-3 text-right">Outflow</th>
                      <th className="px-3 py-3 text-right">Running balance</th>
                      <th className="px-3 py-3">Source</th>
                      <th className="px-3 py-3">User</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {account.rows.map((row) => (
                      <tr key={row.id}>
                        <td className="whitespace-nowrap px-3 py-3 align-top font-semibold">
                          {row.entryDate}
                          <span className="mt-1 block text-xs font-normal text-slate-500">
                            {formatInstantInBusinessTimeZone(
                              row.createdAt,
                              context.business.timezone,
                            )}
                          </span>
                        </td>
                        <td className="min-w-56 px-3 py-3 align-top">
                          <span className="font-semibold capitalize text-slate-950">
                            {typeLabel(row.entryType)}
                          </span>
                          {row.isReversal ? (
                            <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                              Reversal
                            </span>
                          ) : null}
                          <span className="mt-1 block text-slate-600">
                            {row.description ?? "No description"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right align-top font-semibold text-emerald-800">
                          {row.inflowRon === "0.00"
                            ? "—"
                            : formatRON(row.inflowRon)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right align-top font-semibold text-red-800">
                          {row.outflowRon === "0.00"
                            ? "—"
                            : formatRON(row.outflowRon)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right align-top font-bold">
                          {formatRON(row.runningBalanceRon)}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <Link
                            className="font-semibold text-teal-700 hover:text-teal-900"
                            href={row.sourceHref}
                          >
                            Open source
                          </Link>
                          <span className="mt-1 block max-w-44 break-all text-xs text-slate-400">
                            {row.sourceEntityType}: {row.sourceEntityId}
                          </span>
                        </td>
                        <td className="max-w-40 break-words px-3 py-3 align-top text-slate-700">
                          {row.createdByName}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
