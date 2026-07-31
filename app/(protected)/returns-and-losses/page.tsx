import { randomUUID } from "node:crypto";

import { CollapsiblePanel } from "@/components/collapsible-panel";
import { HistoryPeriodFilter } from "@/components/history-period-filter";
import { InventoryExceptionForm } from "@/components/inventory-exception-form";
import { SaleReturnForm } from "@/components/sale-return-form";
import { Step36ReversalForm } from "@/components/step36-reversal-form";
import { requireAdmin } from "@/lib/auth/session";
import { formatInstantInBusinessTimeZone } from "@/lib/date/business-date";
import { resolveHistoryPeriod } from "@/lib/date/history-date";
import { formatRON, parseMoneyInput } from "@/lib/money/money";
import { getOpenBusinessDay } from "@/services/business-days";
import {
  getDamagedStockBalances,
  getInventoryExceptionOptions,
  getInventoryExceptions,
  getReturnableSales,
  getSaleReturns,
} from "@/services/returns-and-losses";

const successMessages: Readonly<Record<string, string>> = {
  returnCreated: "Customer return and refund recorded.",
  returnReversed: "Customer return reversed with compensating effects.",
  exceptionCreated: "Inventory exception recorded.",
  exceptionReversed: "Inventory exception reversed.",
};

export default async function ReturnsAndLossesPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const context = await requireAdmin();
  const query = await searchParams;
  const historyPeriod = resolveHistoryPeriod(query, context.business.timezone);
  const [
    openDay,
    returnableSales,
    returns,
    exceptionOptions,
    exceptions,
    damagedStock,
  ] = await Promise.all([
    getOpenBusinessDay(context.business.id),
    getReturnableSales(context),
    getSaleReturns(context, historyPeriod),
    getInventoryExceptionOptions(context),
    getInventoryExceptions(context, historyPeriod),
    getDamagedStockBalances(context),
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

      {openDay ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold text-slate-950">
              Customer return
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Refund uses original selling prices. Sellable products return to
              shop stock; damaged products are tracked separately and do not
              return to sellable inventory value.
            </p>
            <div className="mt-5">
              <SaleReturnForm
                openDay={openDay}
                requestId={randomUUID()}
                sales={returnableSales}
              />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold text-slate-950">
              Damage, missing, or stolen stock
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Quantity and weighted historical value leave the selected
              location. Damaged pieces remain visible in damaged-stock totals;
              missing and stolen pieces do not.
            </p>
            <div className="mt-5">
              <InventoryExceptionForm
                openDay={openDay}
                options={exceptionOptions}
                requestId={randomUUID()}
              />
            </div>
          </section>
        </div>
      ) : (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-xl font-bold text-amber-950">
            Current business day unavailable
          </h2>
          <p className="mt-2 text-sm text-amber-900">
            Refresh shortly. Returns and inventory exceptions require the
            automatically opened current day.
          </p>
        </section>
      )}

      <CollapsiblePanel title="Damaged stock currently held">
        {damagedStock.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
            No damaged products are currently recorded.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2 text-right">Damaged pieces</th>
                  <th className="px-3 py-2 text-right">Historical cost</th>
                </tr>
              </thead>
              <tbody>
                {damagedStock.map((item) => (
                  <tr
                    className="border-b border-slate-100"
                    key={item.productId}
                  >
                    <td className="px-3 py-3">
                      <span className="font-mono text-xs text-teal-800">
                        {item.productCode}
                      </span>
                      <span className="ml-2 font-semibold">
                        {item.productName}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold">
                      {item.quantity}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatRON(parseMoneyInput(item.historicalCostRon))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CollapsiblePanel>

      <HistoryPeriodFilter
        action="/returns-and-losses"
        anchor="customer-return-history"
        error={historyPeriod.error}
        fromDate={historyPeriod.fromDate}
        toDate={historyPeriod.toDate}
      />

      <CollapsiblePanel
        description={`Returns from ${historyPeriod.fromDate} to ${historyPeriod.toDate}.`}
        id="customer-return-history"
        title="Customer return history"
      >
        {returns.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
            No customer returns were recorded from {historyPeriod.fromDate} to{" "}
            {historyPeriod.toDate}.
          </p>
        ) : (
          <ul className="mt-5 max-h-[38rem] space-y-4 overflow-y-auto overscroll-contain pr-2">
            {returns.map((item) => (
              <li
                className="rounded-2xl border border-slate-200 p-5"
                key={item.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-bold">
                      Return for sale #{item.saleNumber} · {item.returnDate}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {item.customerName
                        ? `Customer: ${item.customerName} · `
                        : ""}
                      recorded by{" "}
                      {item.createdByName ?? "Unknown administrator"} at{" "}
                      {formatInstantInBusinessTimeZone(
                        item.createdAt,
                        context.business.timezone,
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={
                        item.status === "active"
                          ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800"
                          : "rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                      }
                    >
                      {item.status}
                    </span>
                    <p className="mt-2 font-bold text-red-800">
                      {formatRON(parseMoneyInput(item.totalRefundRon))}
                    </p>
                  </div>
                </div>
                <div className="mt-4 overflow-x-auto rounded-xl bg-slate-50 p-3">
                  <table className="w-full min-w-[38rem] text-left text-sm">
                    <thead className="text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-2 py-2">Product</th>
                        <th className="px-2 py-2 text-right">Qty</th>
                        <th className="px-2 py-2">Condition</th>
                        <th className="px-2 py-2 text-right">Refund</th>
                        <th className="px-2 py-2 text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.lines.map((line) => (
                        <tr className="border-t border-slate-200" key={line.id}>
                          <td className="px-2 py-3">
                            {line.productCode} · {line.productName}
                          </td>
                          <td className="px-2 py-3 text-right">
                            {line.quantity}
                          </td>
                          <td className="px-2 py-3">{line.disposition}</td>
                          <td className="px-2 py-3 text-right">
                            {formatRON(parseMoneyInput(line.lineRefundRon))}
                          </td>
                          <td className="px-2 py-3 text-right">
                            {formatRON(parseMoneyInput(line.lineCostRon))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  Cash {formatRON(parseMoneyInput(item.cashRefundRon))} · Bank{" "}
                  {formatRON(parseMoneyInput(item.bankRefundRon))} · Credit
                  reduction{" "}
                  {formatRON(parseMoneyInput(item.creditReductionRon))}
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Reason: {item.reason}
                </p>
                {item.status === "reversed" && item.reversalReason ? (
                  <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
                    Reversal: {item.reversalReason}
                  </p>
                ) : null}
                {item.status === "active" ? (
                  <Step36ReversalForm kind="sale_return" recordId={item.id} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CollapsiblePanel>

      <CollapsiblePanel
        description={`Exceptions from ${historyPeriod.fromDate} to ${historyPeriod.toDate}.`}
        title="Inventory exception history"
      >
        {exceptions.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
            No damage, missing, or stolen stock was recorded from{" "}
            {historyPeriod.fromDate} to {historyPeriod.toDate}.
          </p>
        ) : (
          <ul className="mt-5 max-h-[38rem] space-y-4 overflow-y-auto overscroll-contain pr-2">
            {exceptions.map((item) => (
              <li
                className="rounded-2xl border border-slate-200 p-5"
                key={item.id}
              >
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <p className="font-bold capitalize">
                      {item.exceptionType} · {item.productCode} ·{" "}
                      {item.productName}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {item.exceptionDate} · {item.sourceLocationName} (
                      {item.sourceLocationType}) · recorded by{" "}
                      {item.createdByName ?? "Unknown administrator"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={
                        item.status === "active"
                          ? "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800"
                          : "rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                      }
                    >
                      {item.status}
                    </span>
                    <p className="mt-2 font-bold">
                      {item.quantity} pieces ·{" "}
                      {formatRON(parseMoneyInput(item.totalCostRon))}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-700">
                  Reason: {item.reason}
                </p>
                {item.status === "reversed" && item.reversalReason ? (
                  <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
                    Reversal: {item.reversalReason}
                  </p>
                ) : null}
                {item.status === "active" ? (
                  <Step36ReversalForm
                    kind="inventory_exception"
                    recordId={item.id}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CollapsiblePanel>
    </div>
  );
}
