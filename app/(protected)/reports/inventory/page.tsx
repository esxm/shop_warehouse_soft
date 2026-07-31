import Link from "next/link";

import Decimal from "decimal.js";

import { ReportNavigation } from "@/components/report-navigation";
import { StockThresholdForm } from "@/components/stock-threshold-form";
import {
  redirectEmployeeToDailySales,
  requireBusinessMember,
} from "@/lib/auth/session";
import { getTodayInBusinessTimeZone } from "@/lib/date/business-date";
import { formatRON, parseMoneyInput } from "@/lib/money/money";
import { resolveRevenueQuery, type RevenuePreset } from "@/lib/reports/revenue";
import { getInventoryAnalysis } from "@/services/inventory-analysis";

const presetLinks: readonly Readonly<{
  label: string;
  value: RevenuePreset;
}>[] = [
  { label: "Today", value: "today" },
  { label: "Current week", value: "current_week" },
  { label: "Current month", value: "current_month" },
  { label: "Previous month", value: "previous_month" },
];

function formatPercent(value: string): string {
  return `${new Decimal(value).toFixed(2)}%`;
}

function formatUnitRON(unitCostRon: string): string {
  try {
    return formatRON(parseMoneyInput(new Decimal(unitCostRon).toFixed(2)));
  } catch {
    return `${unitCostRon} RON`;
  }
}

export default async function InventoryAnalysisPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const context = await requireBusinessMember();
  redirectEmployeeToDailySales(context);
  const query = await searchParams;
  const today = getTodayInBusinessTimeZone(context.business.timezone);
  const resolved = resolveRevenueQuery(query, today);
  const report = await getInventoryAnalysis(context, resolved.range);
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
          href={`/reports/inventory.csv?${exportQuery.toString()}`}
        >
          Export CSV
        </a>
      </div>

      {query.thresholdSaved === "1" ? (
        <p
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-950"
          role="status"
        >
          Low-stock threshold saved.
        </p>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-bold text-slate-950">Date range</h2>
        <div className="mt-5 flex flex-wrap gap-2">
          {presetLinks.map((preset) => (
            <Link
              className={
                resolved.range.preset === preset.value
                  ? "rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              }
              href={`/reports/inventory?preset=${preset.value}`}
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
            Apply range
          </button>
        </form>
        {resolved.error ? (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {resolved.error} Showing the current month instead.
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">
            Current valued inventory
          </p>
          <p className="mt-3 text-2xl font-bold">
            {formatRON(parseMoneyInput(report.totalInventoryValueRon))}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">
            Low-stock locations
          </p>
          <p className="mt-3 text-2xl font-bold">{report.lowStockCount}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">
            Net product revenue
          </p>
          <p className="mt-3 text-2xl font-bold">
            {formatRON(parseMoneyInput(report.totalNetRevenueRon))}
          </p>
        </article>
        <article className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
          <p className="text-xs font-semibold uppercase text-teal-700">
            Product profit estimate
          </p>
          <p className="mt-3 text-2xl font-bold text-teal-950">
            {formatRON(parseMoneyInput(report.totalGrossMarginRon))}
          </p>
          <p className="mt-1 text-sm font-semibold text-teal-800">
            {formatPercent(report.totalProfitPercentOnCost)} on historical cost
          </p>
          <p className="mt-1 text-xs text-teal-700">
            {formatPercent(report.totalGrossMarginPercent)} gross margin on
            revenue
          </p>
        </article>
      </section>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
        Profit percentage on historical cost matches Daily Sales: profit divided
        by historical cost. Gross margin percentage uses the standard revenue
        denominator: profit divided by net revenue. Both use the same profit
        amount and historical weighted cost, never the current USD rate or
        replacement cost. They exclude operating expenses, taxes, and overhead.
      </section>

      {context.role === "admin" ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-2xl font-bold">Low-stock thresholds</h2>
          <p className="mt-2 text-sm text-slate-600">
            Set a separate minimum piece quantity for each product and location.
            Zero disables its alert.
          </p>
          <div className="mt-5">
            <StockThresholdForm rows={report.currentInventory} />
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-bold">Current stock and value</h2>
        {report.uncostedLocationCount > 0 ? (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            {report.uncostedLocationCount} nonzero product-location balances
            lack complete historical cost and are excluded from valued totals.
          </p>
        ) : null}
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[60rem] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3">Product</th>
                <th className="px-3 py-3">Location</th>
                <th className="px-3 py-3 text-right">Quantity</th>
                <th className="px-3 py-3 text-right">Threshold</th>
                <th className="px-3 py-3 text-right">Weighted cost</th>
                <th className="px-3 py-3 text-right">Value</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {report.currentInventory.map((row) => (
                <tr
                  className={
                    row.isLowStock
                      ? "border-b border-red-100 bg-red-50"
                      : "border-b border-slate-100"
                  }
                  key={`${row.productId}:${row.locationId}`}
                >
                  <td className="px-3 py-3">
                    <span className="font-mono text-xs text-teal-800">
                      {row.productCode}
                    </span>
                    <span className="ml-2 font-semibold">
                      {row.productName}
                    </span>
                    <span className="ml-2 text-xs text-slate-500">
                      {row.categoryName}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {row.locationName} ({row.locationType})
                  </td>
                  <td className="px-3 py-3 text-right font-semibold">
                    {row.quantity}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {row.minimumQuantity}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {row.averageUnitCostRon
                      ? formatUnitRON(row.averageUnitCostRon)
                      : "Cost required"}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {row.costIsComplete
                      ? formatUnitRON(row.inventoryValueRon)
                      : "Not valued"}
                  </td>
                  <td className="px-3 py-3">
                    {row.isLowStock ? (
                      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
                        Low stock
                      </span>
                    ) : (
                      <span className="text-slate-500">OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {[
          ["Fast-moving products", report.fastMoving],
          ["Slow-moving products", report.slowMoving],
        ].map(([title, rows]) => (
          <section
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            key={title as string}
          >
            <h2 className="text-xl font-bold">{title as string}</h2>
            {(rows as typeof report.fastMoving).length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">
                No matching product activity in this range.
              </p>
            ) : (
              <ol className="mt-4 space-y-3">
                {(rows as typeof report.fastMoving).map((row, index) => (
                  <li
                    className="flex justify-between gap-4 rounded-xl bg-slate-50 p-4"
                    key={row.productId}
                  >
                    <span>
                      {index + 1}. {row.productCode} · {row.productName}
                    </span>
                    <span className="font-semibold">
                      {row.netSoldQuantity} net sold · {row.currentQuantity} in
                      stock
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-bold">Sales by product</h2>
        {report.productSales.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            No product sales or returns exist in this date range.
          </p>
        ) : (
          <div className="mt-5 max-h-[38rem] overflow-auto overscroll-contain">
            <table className="w-full min-w-[70rem] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3">Product</th>
                  <th className="px-3 py-3 text-right">Sold</th>
                  <th className="px-3 py-3 text-right">Returned</th>
                  <th className="px-3 py-3 text-right">Net revenue</th>
                  <th className="px-3 py-3 text-right">Historical cost</th>
                  <th className="px-3 py-3 text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {report.productSales.map((row) => (
                  <tr className="border-b border-slate-100" key={row.productId}>
                    <td className="px-3 py-3 font-semibold">
                      {row.productCode} · {row.productName}
                    </td>
                    <td className="px-3 py-3 text-right">{row.soldQuantity}</td>
                    <td className="px-3 py-3 text-right">
                      {row.returnedQuantity}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatRON(parseMoneyInput(row.netRevenueRon))}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatRON(parseMoneyInput(row.historicalCostRon))}
                    </td>
                    <td className="px-3 py-3 text-right font-bold">
                      {formatRON(parseMoneyInput(row.grossMarginRon))} ·{" "}
                      {formatPercent(row.profitPercentOnCost)} on cost
                      <span className="mt-1 block text-xs font-normal text-slate-500">
                        {formatPercent(row.grossMarginPercent)} margin on
                        revenue
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-bold">Product movement history</h2>
        {report.movements.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            No product movements exist in this date range.
          </p>
        ) : (
          <div className="mt-5 max-h-[38rem] overflow-auto overscroll-contain">
            <table className="w-full min-w-[62rem] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Product</th>
                  <th className="px-3 py-3">Movement</th>
                  <th className="px-3 py-3">Route</th>
                  <th className="px-3 py-3 text-right">Quantity</th>
                  <th className="px-3 py-3 text-right">Unit cost</th>
                  <th className="px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {report.movements.map((row) => (
                  <tr className="border-b border-slate-100" key={row.id}>
                    <td className="px-3 py-3">{row.businessDate}</td>
                    <td className="px-3 py-3 font-semibold">
                      {row.productCode} · {row.productName}
                    </td>
                    <td className="px-3 py-3">{row.movementType}</td>
                    <td className="px-3 py-3">
                      {row.sourceLocationName ?? "Outside"} →{" "}
                      {row.destinationLocationName ?? "Outside"}
                    </td>
                    <td className="px-3 py-3 text-right">{row.quantity}</td>
                    <td className="px-3 py-3 text-right">
                      {row.unitCostRon ? formatUnitRON(row.unitCostRon) : "—"}
                    </td>
                    <td className="px-3 py-3">{row.status}</td>
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
