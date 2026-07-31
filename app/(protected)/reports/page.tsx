import Link from "next/link";

import { ReportNavigation } from "@/components/report-navigation";
import {
  redirectEmployeeToDailySales,
  requireBusinessMember,
} from "@/lib/auth/session";
import { getTodayInBusinessTimeZone } from "@/lib/date/business-date";
import { formatRON, type MoneyAmount } from "@/lib/money/money";
import { resolveRevenueQuery, type RevenuePreset } from "@/lib/reports/revenue";
import { getRevenueReport } from "@/services/revenue-report";

const presetLinks: readonly Readonly<{
  label: string;
  value: RevenuePreset;
}>[] = [
  { label: "Today", value: "today" },
  { label: "Current week", value: "current_week" },
  { label: "Current month", value: "current_month" },
  { label: "Previous month", value: "previous_month" },
];

function SummaryCard({
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

export default async function ReportsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const context = await requireBusinessMember();
  redirectEmployeeToDailySales(context);
  const query = await searchParams;
  const today = getTodayInBusinessTimeZone(context.business.timezone);
  const resolved = resolveRevenueQuery(query, today);
  const report = await getRevenueReport(context, resolved.range);
  const exportQuery = new URLSearchParams({
    from: resolved.range.fromDate,
    to: resolved.range.toDate,
  });

  return (
    <div className="space-y-6">
      <ReportNavigation />

      <div className="flex justify-end">
        <a
          className="inline-flex w-fit rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white"
          href={`/reports/revenue.csv?${exportQuery.toString()}`}
        >
          Export CSV
        </a>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-bold text-slate-950">Date range</h2>
        <div className="mt-5 flex flex-wrap gap-2" aria-label="Date presets">
          {presetLinks.map((preset) => {
            const active = resolved.range.preset === preset.value;

            return (
              <Link
                aria-current={active ? "true" : undefined}
                className={
                  active
                    ? "rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white"
                    : "rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-teal-500 hover:bg-teal-50"
                }
                href={`/reports?preset=${preset.value}`}
                key={preset.value}
              >
                {preset.label}
              </Link>
            );
          })}
        </div>

        <form
          className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto]"
          method="get"
        >
          <label className="text-sm font-semibold text-slate-800">
            From date
            <input
              className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950"
              defaultValue={resolved.range.fromDate}
              name="from"
              required
              type="date"
            />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            To date
            <input
              className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-950"
              defaultValue={resolved.range.toDate}
              name="to"
              required
              type="date"
            />
          </label>
          <button
            className="w-full self-end rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white sm:w-auto"
            type="submit"
          >
            Apply range
          </button>
        </form>
        {resolved.error ? (
          <p
            className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            {resolved.error} Showing the current month instead.
          </p>
        ) : null}
        <p className="mt-4 text-sm text-slate-600">
          Selected: {resolved.range.fromDate} through {resolved.range.toDate}
        </p>
      </section>

      <section
        aria-label="Selected range totals"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <SummaryCard amount={report.totals.cashSalesRon} label="Cash sales" />
        <SummaryCard amount={report.totals.bankSalesRon} label="Bank sales" />
        <SummaryCard
          amount={report.totals.creditSalesRon}
          label="Credit sales"
        />
        <SummaryCard
          amount={report.totals.totalRevenueRon}
          label="Total revenue"
        />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-bold text-slate-950">Daily revenue</h2>
        {report.daily.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
            No closed daily-sales records exist in this date range.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">
                Daily revenue for the selected date range
              </caption>
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3 text-right">Cash</th>
                  <th className="px-3 py-3 text-right">Bank</th>
                  <th className="px-3 py-3 text-right">Credit</th>
                  <th className="px-3 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.daily.map((day) => (
                  <tr key={day.businessDate}>
                    <th
                      className="whitespace-nowrap px-3 py-3 font-semibold text-slate-900"
                      scope="row"
                    >
                      {day.businessDate}
                    </th>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-slate-700">
                      {formatRON(day.cashSalesRon)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-slate-700">
                      {formatRON(day.bankSalesRon)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-slate-700">
                      {formatRON(day.creditSalesRon)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-bold text-slate-950">
                      {formatRON(day.totalRevenueRon)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-950">
                <tr>
                  <th className="px-3 py-3" scope="row">
                    Selected range
                  </th>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    {formatRON(report.totals.cashSalesRon)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    {formatRON(report.totals.bankSalesRon)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    {formatRON(report.totals.creditSalesRon)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    {formatRON(report.totals.totalRevenueRon)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-bold text-slate-950">
          Monthly aggregation
        </h2>
        {report.monthly.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            Monthly totals will appear when closed sales exist in this range.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">
                Monthly revenue aggregation for the selected date range
              </caption>
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">Month</th>
                  <th className="px-3 py-3 text-right">Cash</th>
                  <th className="px-3 py-3 text-right">Bank</th>
                  <th className="px-3 py-3 text-right">Credit</th>
                  <th className="px-3 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.monthly.map((month) => (
                  <tr key={month.month}>
                    <th
                      className="whitespace-nowrap px-3 py-3 font-semibold text-slate-900"
                      scope="row"
                    >
                      {month.month}
                    </th>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      {formatRON(month.cashSalesRon)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      {formatRON(month.bankSalesRon)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      {formatRON(month.creditSalesRon)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-bold">
                      {formatRON(month.totalRevenueRon)}
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
