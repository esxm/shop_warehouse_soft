import Link from "next/link";

import { ReportNavigation } from "@/components/report-navigation";
import {
  redirectEmployeeToDailySales,
  requireBusinessMember,
} from "@/lib/auth/session";
import { getTodayInBusinessTimeZone } from "@/lib/date/business-date";
import { formatRON, formatUSD, type MoneyAmount } from "@/lib/money/money";
import {
  supplierPayablesFilterSchema,
  type SupplierPayablesFilter,
} from "@/lib/reports/supplier-payables";
import { getSupplierPayablesPageData } from "@/services/supplier-payables-report";

function firstQueryValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatOriginal(currency: "RON" | "USD", amount: MoneyAmount): string {
  return currency === "RON" ? formatRON(amount) : formatUSD(amount);
}

export default async function SupplierPayablesReportPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const context = await requireBusinessMember();
  redirectEmployeeToDailySales(context);
  const query = await searchParams;
  const filterResult = supplierPayablesFilterSchema.safeParse({
    supplierId: firstQueryValue(query.supplierId),
    currency: firstQueryValue(query.currency),
    outstandingOnly: firstQueryValue(query.outstandingOnly),
    dueFromDate: firstQueryValue(query.dueFromDate),
    dueToDate: firstQueryValue(query.dueToDate),
  });
  const defaultFilter = supplierPayablesFilterSchema.parse({});
  const filter: SupplierPayablesFilter = filterResult.success
    ? filterResult.data
    : defaultFilter;
  const asOfDate = getTodayInBusinessTimeZone(context.business.timezone);
  const { suppliers, report, currentUsdRonRate } =
    await getSupplierPayablesPageData(context, filter, asOfDate);
  const exportQuery = new URLSearchParams({
    currency: filter.currency,
    outstandingOnly: filter.outstandingOnly ? "1" : "0",
  });

  if (filter.supplierId) {
    exportQuery.set("supplierId", filter.supplierId);
  }
  if (filter.dueFromDate) {
    exportQuery.set("dueFromDate", filter.dueFromDate);
  }
  if (filter.dueToDate) {
    exportQuery.set("dueToDate", filter.dueToDate);
  }

  const missingRate =
    report.summary.totalUsdPayables !== "0.00" && !currentUsdRonRate;

  return (
    <div className="space-y-6">
      <ReportNavigation />

      <div className="flex justify-end">
        <a
          className="inline-flex w-fit rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white"
          href={`/reports/payables.csv?${exportQuery.toString()}`}
        >
          Export CSV
        </a>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-bold text-slate-950">Filters</h2>
        <form
          className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-[1.3fr_0.8fr_1fr_1fr_auto]"
          method="get"
        >
          <label className="text-sm font-semibold text-slate-800">
            Supplier
            <select
              className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              defaultValue={filter.supplierId ?? ""}
              name="supplierId"
            >
              <option value="">All suppliers</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Currency
            <select
              className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              defaultValue={filter.currency}
              name="currency"
            >
              <option value="all">RON and USD</option>
              <option value="RON">RON</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Due from
            <input
              className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3"
              defaultValue={filter.dueFromDate ?? ""}
              name="dueFromDate"
              type="date"
            />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Due through
            <input
              className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3"
              defaultValue={filter.dueToDate ?? ""}
              name="dueToDate"
              type="date"
            />
          </label>
          <div className="flex flex-col justify-end gap-3">
            <label className="text-sm font-semibold text-slate-800">
              Balance
              <select
                className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
                defaultValue={filter.outstandingOnly ? "1" : "0"}
                name="outstandingOnly"
              >
                <option value="1">Outstanding only</option>
                <option value="0">All purchases</option>
              </select>
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
              "Check the payables filters."}{" "}
            Showing the default outstanding report.
          </p>
        ) : null}
        <p className="mt-4 text-xs leading-5 text-slate-500">
          Leave due dates empty to include every purchase. When a due-date range
          is entered, the range includes both endpoints.
        </p>
      </section>

      <section
        aria-label="Supplier payables summary"
        className="grid gap-4 sm:grid-cols-3"
      >
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            RON payables
          </h2>
          <p className="mt-3 text-2xl font-bold text-slate-950">
            {formatRON(report.summary.totalRonPayables)}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            USD payables
          </h2>
          <p className="mt-3 text-2xl font-bold text-slate-950">
            {formatUSD(report.summary.totalUsdPayables)}
          </p>
        </article>
        <article className="rounded-2xl border border-teal-200 bg-teal-50 p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-teal-700">
            Estimated total RON
          </h2>
          <p className="mt-3 text-2xl font-bold text-teal-950">
            {report.summary.estimatedTotalRon
              ? formatRON(report.summary.estimatedTotalRon)
              : "Unavailable"}
          </p>
        </article>
      </section>

      <section
        className={
          missingRate
            ? "rounded-3xl border border-amber-300 bg-amber-50 p-6"
            : "rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        }
      >
        <h2
          className={
            missingRate
              ? "text-xl font-bold text-amber-950"
              : "text-xl font-bold text-slate-950"
          }
        >
          Manual current USD/RON reference rate
        </h2>
        {currentUsdRonRate ? (
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Current estimate uses{" "}
            <strong>{currentUsdRonRate.rate} RON per USD</strong>, effective{" "}
            {currentUsdRonRate.effectiveDate}. Historical purchase and payment
            rates are unchanged.
          </p>
        ) : (
          <p className="mt-2 text-sm leading-6 text-amber-900">
            No effective manual rate is available. Original USD debt remains
            visible, but current RON estimates are unavailable.
          </p>
        )}
        {context.role === "admin" ? (
          <Link
            className="mt-4 inline-flex text-sm font-semibold text-teal-800 underline underline-offset-4"
            href="/"
          >
            Record a reference rate on the dashboard
          </Link>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-950">
              Supplier balances
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Paid values are active allocations in the row currency.
            </p>
          </div>
          <Link
            className="text-sm font-semibold text-teal-700 hover:text-teal-900"
            href="/reports/payables"
          >
            Clear filters
          </Link>
        </div>

        {report.rows.length === 0 ? (
          <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
            No supplier payables match these filters.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">Supplier payable balances</caption>
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">Supplier</th>
                  <th className="px-3 py-3">Currency</th>
                  <th className="px-3 py-3 text-right">Purchases</th>
                  <th className="px-3 py-3 text-right">Paid</th>
                  <th className="px-3 py-3 text-right">Outstanding</th>
                  <th className="px-3 py-3 text-right">Estimated RON</th>
                  <th className="px-3 py-3">Oldest unpaid</th>
                  <th className="px-3 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.rows.map((row) => (
                  <tr key={`${row.supplierId}-${row.currency}`}>
                    <th
                      className="whitespace-nowrap px-3 py-3 font-semibold text-slate-950"
                      scope="row"
                    >
                      {row.supplierName}
                    </th>
                    <td className="px-3 py-3 font-semibold">{row.currency}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      {formatOriginal(row.currency, row.originalPurchaseTotal)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      {formatOriginal(row.currency, row.totalPaid)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-bold text-teal-900">
                      {formatOriginal(
                        row.currency,
                        row.remainingOriginalAmount,
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      {row.estimatedRemainingRon
                        ? formatRON(row.estimatedRemainingRon)
                        : "Unavailable"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {row.oldestUnpaidDate ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      <Link
                        className="font-semibold text-teal-700 hover:text-teal-900"
                        href={`/reports/payables/${row.supplierId}`}
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
