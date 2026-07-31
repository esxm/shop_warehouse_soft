import { randomUUID } from "node:crypto";

import { CollapsiblePanel } from "@/components/collapsible-panel";
import Decimal from "decimal.js";

import { HistoryPeriodFilter } from "@/components/history-period-filter";
import { ProductSaleForm } from "@/components/product-sale-form";
import { ProductSaleReversalForm } from "@/components/product-sale-reversal-form";
import { requireBusinessMember } from "@/lib/auth/session";
import { formatInstantInBusinessTimeZone } from "@/lib/date/business-date";
import { resolveHistoryPeriod } from "@/lib/date/history-date";
import { formatRON, parseMoneyInput } from "@/lib/money/money";
import { getOpenBusinessDay } from "@/services/business-days";
import { searchCustomers } from "@/services/customers";
import { getDailySalesHistory } from "@/services/daily-sales";
import {
  getDailyProductSalesSummaries,
  getProductSaleOptions,
  getProductSales,
} from "@/services/product-sales";

const successMessages: Readonly<Record<string, string>> = {
  saleCreated: "Individual sale recorded.",
  saleReversed: "Sale reversed and product stock restored.",
};

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

export default async function DailySalesPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const context = await requireBusinessMember();
  const [query, openDay] = await Promise.all([
    searchParams,
    getOpenBusinessDay(context.business.id),
  ]);
  const showHistory = context.role === "admin";
  const historyPeriod = showHistory
    ? resolveHistoryPeriod(query, context.business.timezone)
    : null;
  const [history, products, customers, sales] = await Promise.all([
    historyPeriod
      ? getDailySalesHistory(context, historyPeriod)
      : Promise.resolve([]),
    getProductSaleOptions(context),
    searchCustomers(context, { query: "", includeInactive: false }),
    historyPeriod
      ? getProductSales(context, historyPeriod)
      : Promise.resolve([]),
  ]);
  const summaryDates = [
    ...new Set([
      ...(showHistory ? history.map((day) => day.businessDate) : []),
      ...(openDay ? [openDay.businessDate] : []),
    ]),
  ];
  const dailySummaries = await getDailyProductSalesSummaries(
    context,
    summaryDates,
  );
  const resultKey = Object.keys(successMessages).find(
    (key) => query[key] === "1",
  );
  const summaryByDay = new Map(
    dailySummaries.map((summary) => [summary.businessDayId, summary]),
  );
  const currentSummary = openDay ? summaryByDay.get(openDay.id) : undefined;

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

      {openDay ? (
        <>
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-slate-950">
                  Record a sale
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Current business date: {openDay.businessDate}
                </p>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                Automatically open
              </span>
            </div>
            <div className="mt-5">
              <ProductSaleForm
                customers={customers}
                openDay={openDay}
                products={products}
                requestId={randomUUID()}
              />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold text-slate-950">
              Today&apos;s exact totals
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <article className="rounded-2xl bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Sales
                </p>
                <p className="mt-2 text-xl font-bold text-slate-950">
                  {currentSummary?.saleCount ?? 0}
                </p>
              </article>
              <article className="rounded-2xl bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Revenue
                </p>
                <p className="mt-2 text-xl font-bold text-slate-950">
                  {formatRON(
                    parseMoneyInput(currentSummary?.totalAmountRon ?? "0"),
                  )}
                </p>
              </article>
              <article className="rounded-2xl bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Buying cost
                </p>
                <p className="mt-2 text-xl font-bold text-slate-950">
                  {formatRON(
                    parseMoneyInput(currentSummary?.totalCostRon ?? "0"),
                  )}
                </p>
              </article>
              <article className="rounded-2xl bg-teal-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                  Gross profit
                </p>
                <p className="mt-2 text-xl font-bold text-teal-950">
                  {formatRON(
                    parseMoneyInput(currentSummary?.grossProfitRon ?? "0"),
                  )}
                </p>
                <p className="mt-1 text-sm font-semibold text-teal-800">
                  {formatPercent(currentSummary?.profitPercent ?? "0")} on cost
                </p>
              </article>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              Cash{" "}
              {formatRON(parseMoneyInput(currentSummary?.cashAmountRon ?? "0"))}{" "}
              · Bank{" "}
              {formatRON(parseMoneyInput(currentSummary?.bankAmountRon ?? "0"))}{" "}
              · Credit{" "}
              {formatRON(
                parseMoneyInput(currentSummary?.creditAmountRon ?? "0"),
              )}
            </p>
          </section>
        </>
      ) : (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-xl font-bold text-amber-950">
            Automatic day initialization is unavailable
          </h2>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            Refresh shortly. The database normally initializes the current
            business day automatically.
          </p>
        </section>
      )}

      {historyPeriod ? (
        <>
          <HistoryPeriodFilter
            action="/daily-sales"
            anchor="individual-sale-history"
            error={historyPeriod.error}
            fromDate={historyPeriod.fromDate}
            toDate={historyPeriod.toDate}
          />

          <CollapsiblePanel
            description={`Sales from ${historyPeriod.fromDate} to ${historyPeriod.toDate}.`}
            id="individual-sale-history"
            title="Individual sale history"
          >
            <p className="mt-2 text-sm text-slate-600">
              Employees cannot edit or remove a recorded sale. Administrators
              can reverse an incorrect sale while the same business day is open.
            </p>
            {sales.length === 0 ? (
              <p className="mt-4 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
                No individual product sales were recorded from{" "}
                {historyPeriod.fromDate} to {historyPeriod.toDate}.
              </p>
            ) : (
              <ul className="mt-5 max-h-[38rem] space-y-4 overflow-y-auto overscroll-contain pr-2">
                {sales.map((sale) => (
                  <li
                    className="rounded-2xl border border-slate-200 p-5"
                    id={`product-sale-${sale.id}`}
                    key={sale.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="font-bold text-slate-950">
                          Sale #{sale.saleNumber} · {sale.saleDate}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {sale.shopLocationName} · recorded by{" "}
                          {sale.createdByName ??
                            (sale.createdBy === context.user.id
                              ? `${context.user.displayName} (${context.role})`
                              : "Team member")}{" "}
                          at{" "}
                          {formatInstantInBusinessTimeZone(
                            sale.createdAt,
                            context.business.timezone,
                          )}
                        </p>
                        {sale.customerName ? (
                          <p className="mt-1 text-sm text-slate-700">
                            Credit customer: {sale.customerName}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <span
                          className={
                            sale.status === "active"
                              ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800"
                              : "rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                          }
                        >
                          {sale.status}
                        </span>
                        <p className="mt-2 text-lg font-bold text-teal-900">
                          {formatRON(parseMoneyInput(sale.totalAmountRon))}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 overflow-x-auto rounded-xl bg-slate-50 p-3">
                      <table className="w-full min-w-[48rem] text-left text-sm">
                        <thead className="text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-2 py-2">Product</th>
                            <th className="px-2 py-2 text-right">Qty</th>
                            <th className="px-2 py-2 text-right">
                              Buying price
                            </th>
                            <th className="px-2 py-2 text-right">
                              Selling price
                            </th>
                            <th className="px-2 py-2 text-right">Revenue</th>
                            <th className="px-2 py-2 text-right">Profit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sale.lines.map((line) => (
                            <tr
                              className="border-t border-slate-200"
                              key={line.id}
                            >
                              <td className="px-2 py-3">
                                <span className="font-mono text-xs text-teal-800">
                                  {line.productCode}
                                </span>
                                <span className="ml-2 font-semibold text-slate-900">
                                  {line.productName}
                                </span>
                              </td>
                              <td className="px-2 py-3 text-right">
                                {line.quantity}
                              </td>
                              <td className="px-2 py-3 text-right">
                                {formatUnitRON(line.unitCostRon)}
                              </td>
                              <td className="px-2 py-3 text-right">
                                {formatRON(
                                  parseMoneyInput(line.unitSellingPriceRon),
                                )}
                              </td>
                              <td className="px-2 py-3 text-right">
                                {formatRON(parseMoneyInput(line.lineTotalRon))}
                              </td>
                              <td className="px-2 py-3 text-right font-semibold">
                                {formatRON(
                                  parseMoneyInput(line.grossProfitRon),
                                )}{" "}
                                · {formatPercent(line.profitPercent)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 flex flex-wrap justify-between gap-4 text-sm">
                      <p className="text-slate-600">
                        Cash {formatRON(parseMoneyInput(sale.cashAmountRon))} ·
                        Bank {formatRON(parseMoneyInput(sale.bankAmountRon))} ·
                        Credit{" "}
                        {formatRON(parseMoneyInput(sale.creditAmountRon))}
                      </p>
                      <p className="font-bold text-teal-900">
                        Profit {formatRON(parseMoneyInput(sale.grossProfitRon))}{" "}
                        · {formatPercent(sale.profitPercent)} on cost
                      </p>
                    </div>
                    {sale.notes ? (
                      <p className="mt-3 text-sm text-slate-700">
                        {sale.notes}
                      </p>
                    ) : null}
                    {sale.status === "reversed" && sale.reversalReason ? (
                      <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                        Reversal: {sale.reversalReason}
                      </p>
                    ) : null}
                    {context.role === "admin" &&
                    sale.status === "active" &&
                    openDay?.id === sale.businessDayId ? (
                      <ProductSaleReversalForm saleId={sale.id} />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CollapsiblePanel>

          <CollapsiblePanel title="Daily profit history">
            {history.length === 0 ? (
              <p className="mt-4 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
                No daily sales record exists from {historyPeriod.fromDate} to{" "}
                {historyPeriod.toDate}.
              </p>
            ) : (
              <ul className="mt-5 max-h-[38rem] space-y-3 overflow-y-auto overscroll-contain pr-2">
                {history.map((day) => {
                  const productSummary = summaryByDay.get(day.businessDayId);
                  return (
                    <li
                      className="rounded-2xl border border-slate-200 p-5"
                      key={day.id}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="font-bold text-slate-950">
                            {day.businessDate}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {productSummary?.saleCount ?? 0} individual sales ·
                            Cash {formatRON(parseMoneyInput(day.cashSalesRon))}{" "}
                            · Bank{" "}
                            {formatRON(parseMoneyInput(day.bankSalesRon))} ·
                            Credit{" "}
                            {formatRON(parseMoneyInput(day.creditSalesRon))}
                          </p>
                        </div>
                        <div className="text-right">
                          <span
                            className={
                              day.status === "closed"
                                ? "rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                                : "rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800"
                            }
                          >
                            {day.status}
                          </span>
                          <p className="mt-2 font-bold text-teal-900">
                            Profit{" "}
                            {formatRON(
                              parseMoneyInput(
                                productSummary?.grossProfitRon ?? "0",
                              ),
                            )}{" "}
                            ·{" "}
                            {formatPercent(
                              productSummary?.profitPercent ?? "0",
                            )}
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">
                        {day.lastDraftByName && day.lastDraftAt
                          ? `Last recorded by ${day.lastDraftByName} at ${formatInstantInBusinessTimeZone(
                              day.lastDraftAt,
                              context.business.timezone,
                            )}`
                          : "No individual sale was recorded for this day"}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CollapsiblePanel>
        </>
      ) : null}
    </div>
  );
}
