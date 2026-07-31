import Link from "next/link";

import { ReportNavigation } from "@/components/report-navigation";
import {
  redirectEmployeeToDailySales,
  requireBusinessMember,
} from "@/lib/auth/session";
import { getTodayInBusinessTimeZone } from "@/lib/date/business-date";
import { formatRON, parseMoneyInput } from "@/lib/money/money";
import type { ProfitBreakdown } from "@/lib/reports/profit";
import { resolveRevenueQuery, type RevenuePreset } from "@/lib/reports/revenue";
import { getProfitReport } from "@/services/profit-report";

const presetLinks: readonly Readonly<{
  label: string;
  value: RevenuePreset;
}>[] = [
  { label: "Today", value: "today" },
  { label: "Current week", value: "current_week" },
  { label: "Current month", value: "current_month" },
  { label: "Previous month", value: "previous_month" },
];

function ProfitTable({
  title,
  rows,
}: Readonly<{
  title: string;
  rows: readonly Readonly<{ label: string; value: ProfitBreakdown }>[];
}>) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-2xl font-bold text-slate-950">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">
          No product sales or returns exist in this period.
        </p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[58rem] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3">Period</th>
                <th className="px-3 py-3 text-right">Sold</th>
                <th className="px-3 py-3 text-right">Returned</th>
                <th className="px-3 py-3 text-right">Net revenue</th>
                <th className="px-3 py-3 text-right">Historical cost</th>
                <th className="px-3 py-3 text-right">Product profit</th>
                <th className="px-3 py-3 text-right">Profit %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className="border-b border-slate-100" key={row.label}>
                  <th className="px-3 py-3 font-semibold" scope="row">
                    {row.label}
                  </th>
                  <td className="px-3 py-3 text-right">
                    {row.value.soldQuantity}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {row.value.returnedQuantity}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {formatRON(parseMoneyInput(row.value.netRevenueRon))}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {formatRON(parseMoneyInput(row.value.historicalCostRon))}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-teal-900">
                    {formatRON(parseMoneyInput(row.value.productProfitRon))}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold">
                    {row.value.profitPercent}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function ProfitReportPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const context = await requireBusinessMember();
  redirectEmployeeToDailySales(context);
  const query = await searchParams;
  const resolved = resolveRevenueQuery(
    query,
    getTodayInBusinessTimeZone(context.business.timezone),
  );
  const report = await getProfitReport(context, resolved.range);
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
          href={`/reports/profit.csv?${exportQuery.toString()}`}
        >
          Export CSV
        </a>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-bold">Choose period</h2>
        <div className="mt-5 flex flex-wrap gap-2">
          {presetLinks.map((preset) => (
            <Link
              className={
                resolved.range.preset === preset.value
                  ? "rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              }
              href={`/reports/profit?preset=${preset.value}`}
              key={preset.value}
            >
              {preset.label}
            </Link>
          ))}
        </div>
        <form
          className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto]"
          method="get"
        >
          <label className="text-sm font-semibold">
            From date
            <input
              className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3"
              defaultValue={resolved.range.fromDate}
              name="from"
              required
              type="date"
            />
          </label>
          <label className="text-sm font-semibold">
            To date
            <input
              className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3"
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
            Apply custom period
          </button>
        </form>
        {resolved.error ? (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {resolved.error} Showing the current month instead.
          </p>
        ) : null}
        <p className="mt-4 text-sm text-slate-600">
          Selected: {resolved.range.fromDate} through {resolved.range.toDate}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">
            Net product revenue
          </p>
          <p className="mt-3 text-2xl font-bold">
            {formatRON(parseMoneyInput(report.totals.netRevenueRon))}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">
            Historical product cost
          </p>
          <p className="mt-3 text-2xl font-bold">
            {formatRON(parseMoneyInput(report.totals.historicalCostRon))}
          </p>
        </article>
        <article className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
          <p className="text-xs font-semibold uppercase text-teal-700">
            Selected-period profit
          </p>
          <p className="mt-3 text-2xl font-bold text-teal-950">
            {formatRON(parseMoneyInput(report.totals.productProfitRon))}
          </p>
        </article>
        <article className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
          <p className="text-xs font-semibold uppercase text-teal-700">
            Profit percentage
          </p>
          <p className="mt-3 text-2xl font-bold text-teal-950">
            {report.totals.profitPercent}%
          </p>
          <p className="mt-1 text-xs text-teal-800">Profit on cost</p>
        </article>
      </section>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
        This is product gross profit: net selling revenue minus historical
        buying cost. It does not subtract rent, salaries, taxes, or other
        operating expenses, so it is not final accounting net profit. Profit
        percentage is profit divided by historical product cost.
      </section>

      <ProfitTable
        rows={report.daily.map((row) => ({
          label: row.businessDate,
          value: row,
        }))}
        title="Profit by day"
      />
      <ProfitTable
        rows={report.weekly.map((row) => ({
          label: `${row.weekStart} to ${row.weekEnd}`,
          value: row,
        }))}
        title="Profit by week"
      />
      <ProfitTable
        rows={report.monthly.map((row) => ({
          label: row.month,
          value: row,
        }))}
        title="Profit by month"
      />
    </div>
  );
}
