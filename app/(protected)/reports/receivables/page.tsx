import Link from "next/link";

import { ReportNavigation } from "@/components/report-navigation";
import {
  redirectEmployeeToDailySales,
  requireBusinessMember,
} from "@/lib/auth/session";
import { getTodayInBusinessTimeZone } from "@/lib/date/business-date";
import { formatRON, type MoneyAmount } from "@/lib/money/money";
import {
  customerReceivablesFilterSchema,
  type CustomerReceivablesFilter,
} from "@/lib/reports/customer-receivables";
import { getCustomerReceivablesPageData } from "@/services/customer-receivables-report";

function firstQueryValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function MoneySummaryCard({
  label,
  amount,
}: Readonly<{ label: string; amount: MoneyAmount }>) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </h2>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
        {formatRON(amount)}
      </p>
    </article>
  );
}

export default async function CustomerReceivablesReportPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const context = await requireBusinessMember();
  redirectEmployeeToDailySales(context);
  const query = await searchParams;
  const filterResult = customerReceivablesFilterSchema.safeParse({
    customerId: firstQueryValue(query.customerId),
    outstandingOnly: firstQueryValue(query.outstandingOnly),
    overdueOnly: firstQueryValue(query.overdueOnly),
    fromDate: firstQueryValue(query.fromDate),
    toDate: firstQueryValue(query.toDate),
  });
  const defaultFilter = customerReceivablesFilterSchema.parse({});
  const filter: CustomerReceivablesFilter = filterResult.success
    ? filterResult.data
    : defaultFilter;
  const asOfDate = getTodayInBusinessTimeZone(context.business.timezone);
  const { customers, report } = await getCustomerReceivablesPageData(
    context,
    filter,
    asOfDate,
  );
  const exportQuery = new URLSearchParams({
    outstandingOnly: filter.outstandingOnly ? "1" : "0",
    overdueOnly: filter.overdueOnly ? "1" : "0",
  });

  if (filter.customerId) {
    exportQuery.set("customerId", filter.customerId);
  }
  if (filter.fromDate) {
    exportQuery.set("fromDate", filter.fromDate);
  }
  if (filter.toDate) {
    exportQuery.set("toDate", filter.toDate);
  }

  return (
    <div className="space-y-6">
      <ReportNavigation />

      <div className="flex justify-end">
        <a
          className="inline-flex w-fit rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white"
          href={`/reports/receivables.csv?${exportQuery.toString()}`}
        >
          Export CSV
        </a>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-bold text-slate-950">Filters</h2>
        <form
          className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-[1.3fr_1fr_1fr_1fr_auto]"
          method="get"
        >
          <label className="text-sm font-semibold text-slate-800">
            Customer
            <select
              className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              defaultValue={filter.customerId ?? ""}
              name="customerId"
            >
              <option value="">All customers</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Balance
            <select
              className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              defaultValue={filter.outstandingOnly ? "1" : "0"}
              name="outstandingOnly"
            >
              <option value="1">Outstanding only</option>
              <option value="0">All credit customers</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-800">
            From purchase date
            <input
              className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3"
              defaultValue={filter.fromDate ?? ""}
              name="fromDate"
              type="date"
            />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            To purchase date
            <input
              className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3"
              defaultValue={filter.toDate ?? ""}
              name="toDate"
              type="date"
            />
          </label>
          <div className="flex flex-col justify-end gap-3">
            <label className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-800">
              <input
                defaultChecked={filter.overdueOnly}
                name="overdueOnly"
                type="checkbox"
                value="1"
              />
              Overdue only
            </label>
            <button
              className="w-full rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white sm:w-auto"
              type="submit"
            >
              Apply filters
            </button>
          </div>
        </form>
        {!filterResult.success ? (
          <p
            className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            {filterResult.error.issues[0]?.message ??
              "Check the receivables filters."}{" "}
            Showing the default outstanding report.
          </p>
        ) : null}
        <p className="mt-4 text-xs leading-5 text-slate-500">
          Overdue means an unpaid amount with a due date before {asOfDate}.
          Purchase-date filters include both endpoints.
        </p>
      </section>

      <section
        aria-label="Customer receivables summary"
        className="grid gap-4 sm:grid-cols-3"
      >
        <MoneySummaryCard
          amount={report.summary.totalOutstandingRon}
          label="Outstanding receivables"
        />
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Customers owing
          </h2>
          <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
            {report.summary.customersWithOutstanding}
          </p>
        </article>
        <MoneySummaryCard
          amount={report.summary.overdueAmountRon}
          label="Overdue amount"
        />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-950">
              Customer balances
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Payments are active allocations against the purchases in scope.
            </p>
          </div>
          <Link
            className="text-sm font-semibold text-teal-700 hover:text-teal-900"
            href="/reports/receivables"
          >
            Clear filters
          </Link>
        </div>

        {report.rows.length === 0 ? (
          <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
            No customer receivables match these filters.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">
                Customer receivable balances
              </caption>
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">Customer</th>
                  <th className="px-3 py-3 text-right">Credit purchases</th>
                  <th className="px-3 py-3 text-right">Payments</th>
                  <th className="px-3 py-3 text-right">Remaining</th>
                  <th className="px-3 py-3">Oldest unpaid</th>
                  <th className="px-3 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.rows.map((row) => (
                  <tr key={row.customerId}>
                    <th
                      className="whitespace-nowrap px-3 py-3 font-semibold text-slate-950"
                      scope="row"
                    >
                      {row.customerName}
                    </th>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      {formatRON(row.totalPurchasesRon)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      {formatRON(row.totalPaymentsRon)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-bold text-teal-900">
                      {formatRON(row.remainingBalanceRon)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {row.oldestUnpaidDate ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      <Link
                        className="font-semibold text-teal-700 hover:text-teal-900"
                        href={`/reports/receivables/${row.customerId}`}
                      >
                        Trace balance
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
