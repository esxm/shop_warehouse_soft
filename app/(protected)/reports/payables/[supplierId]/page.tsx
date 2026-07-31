import Link from "next/link";
import { notFound } from "next/navigation";

import { ReportNavigation } from "@/components/report-navigation";
import {
  redirectEmployeeToDailySales,
  requireBusinessMember,
} from "@/lib/auth/session";
import { getTodayInBusinessTimeZone } from "@/lib/date/business-date";
import { resolveOptionalHistoryPeriod } from "@/lib/date/history-date";
import {
  formatRON,
  formatSignedRON,
  formatUSD,
  parseMoneyInput,
  type MoneyAmount,
} from "@/lib/money/money";
import { buildSupplierPayablesReport } from "@/lib/reports/supplier-payables";
import { supplierIdSchema } from "@/lib/validation/suppliers";
import { getSupplierPayments } from "@/services/supplier-payments";
import { getSupplierCurrentUsdRonRate } from "@/services/supplier-payables-report";
import { getSupplierPurchases } from "@/services/supplier-purchases";
import { getSupplier } from "@/services/suppliers";

function formatOriginal(
  currency: "RON" | "USD",
  amount: string | MoneyAmount,
): string {
  const parsed = parseMoneyInput(amount);
  return currency === "RON" ? formatRON(parsed) : formatUSD(parsed);
}

export default async function SupplierPayableTracePage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ supplierId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const context = await requireBusinessMember();
  redirectEmployeeToDailySales(context);
  const [{ supplierId: rawSupplierId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const idResult = supplierIdSchema.safeParse(rawSupplierId);

  if (!idResult.success) {
    notFound();
  }

  const asOfDate = getTodayInBusinessTimeZone(context.business.timezone);
  const historyPeriod = resolveOptionalHistoryPeriod(query);
  const historyScope =
    historyPeriod.fromDate || historyPeriod.toDate
      ? `from ${historyPeriod.fromDate ?? "the beginning"} to ${
          historyPeriod.toDate ?? "today"
        }`
      : "for all dates";
  const [supplier, allPurchases, purchases, payments, currentUsdRonRate] =
    await Promise.all([
      getSupplier(context, idResult.data),
      getSupplierPurchases(context, idResult.data),
      getSupplierPurchases(context, idResult.data, historyPeriod),
      getSupplierPayments(context, idResult.data, historyPeriod),
      getSupplierCurrentUsdRonRate(context, asOfDate),
    ]);

  if (!supplier) {
    notFound();
  }

  const report = buildSupplierPayablesReport(
    allPurchases.map((purchase) => ({
      purchaseId: purchase.id,
      supplierId: purchase.supplierId,
      supplierName: supplier.name,
      purchaseDate: purchase.purchaseDate,
      dueDate: purchase.dueDate,
      currency: purchase.currency,
      originalAmount: purchase.originalAmount,
      allocatedOriginalAmount: purchase.allocatedOriginalAmount,
      remainingOriginalAmount: purchase.remainingOriginalAmount,
      status: purchase.status,
    })),
    {
      supplierId: supplier.id,
      currency: "all",
      outstandingOnly: true,
      dueFromDate: null,
      dueToDate: null,
    },
    currentUsdRonRate?.rate ?? null,
  );
  const allocationTraces = payments.flatMap((payment) =>
    payment.allocations.map((allocation) => ({
      ...allocation,
      paymentDate: payment.paymentDate,
      paymentExchangeRate: payment.paymentExchangeRate,
      paymentStatus: payment.status,
    })),
  );

  return (
    <div className="space-y-6">
      <ReportNavigation />

      <Link
        className="inline-flex text-sm font-semibold text-teal-700 hover:text-teal-900"
        href="/reports/payables"
      >
        ← Back to supplier payables
      </Link>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
              Payable trace
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
              {supplier.name}
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              Historical purchase cost, actual payment cost, and current payable
              estimates remain separate.
            </p>
          </div>
          <Link
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            href={`/suppliers/${supplier.id}`}
          >
            Open supplier operations
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {report.rows.map((row) => (
            <article className="rounded-2xl bg-slate-50 p-4" key={row.currency}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {row.currency} remaining
              </h2>
              <p className="mt-2 text-xl font-bold text-slate-950">
                {formatOriginal(row.currency, row.remainingOriginalAmount)}
              </p>
              <p className="mt-2 text-xs text-slate-600">
                Current estimate:{" "}
                {row.estimatedRemainingRon
                  ? formatRON(row.estimatedRemainingRon)
                  : "Unavailable"}
              </p>
            </article>
          ))}
          <article className="rounded-2xl bg-teal-50 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-teal-700">
              Current estimate rate
            </h2>
            <p className="mt-2 text-xl font-bold text-teal-950">
              {currentUsdRonRate
                ? `${currentUsdRonRate.rate} RON/USD`
                : "Unavailable"}
            </p>
            <p className="mt-2 text-xs text-teal-800">
              {currentUsdRonRate
                ? `Effective ${currentUsdRonRate.effectiveDate}`
                : "No manual effective rate"}
            </p>
          </article>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <form
          action={`/reports/payables/${supplier.id}#supplier-purchase-history`}
          className="flex flex-wrap items-end gap-3"
          method="get"
        >
          <label className="text-sm font-semibold text-slate-800">
            History from
            <input
              className="mt-2 block rounded-xl border border-slate-300 px-4 py-2.5"
              defaultValue={historyPeriod.fromDate ?? ""}
              name="history_from"
              type="date"
            />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            History to
            <input
              className="mt-2 block rounded-xl border border-slate-300 px-4 py-2.5"
              defaultValue={historyPeriod.toDate ?? ""}
              name="history_to"
              type="date"
            />
          </label>
          <button
            className="w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white sm:w-auto"
            type="submit"
          >
            Show period
          </button>
          <Link
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800"
            href={`/reports/payables/${supplier.id}#supplier-purchase-history`}
          >
            Show all
          </Link>
        </form>
        {historyPeriod.error ? (
          <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {historyPeriod.error} Showing all history instead.
          </p>
        ) : null}
      </section>

      <section
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        id="supplier-purchase-history"
      >
        <h2 className="text-2xl font-bold text-slate-950">Purchase history</h2>
        <p className="mt-2 text-sm text-slate-600">
          Historical exchange rates and inventory costs never change when the
          current estimate rate changes. Showing purchases {historyScope},
          ordered by purchase date.
        </p>
        {purchases.length === 0 ? (
          <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
            No purchases were recorded {historyScope}.
          </p>
        ) : (
          <ul className="mt-5 max-h-[38rem] space-y-4 overflow-y-auto overscroll-contain pr-2">
            {purchases.map((purchase) => {
              const purchaseAllocations = allocationTraces.filter(
                (allocation) => allocation.purchaseId === purchase.id,
              );

              return (
                <li
                  className="scroll-mt-6 rounded-2xl border border-slate-200 p-5"
                  id={`supplier-purchase-${purchase.id}`}
                  key={purchase.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-slate-950">
                        {formatOriginal(
                          purchase.currency,
                          purchase.originalAmount,
                        )}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Purchased {purchase.purchaseDate}
                        {purchase.dueDate
                          ? ` · Due ${purchase.dueDate}`
                          : " · No due date"}
                      </p>
                      <p className="mt-1 break-all text-xs text-slate-400">
                        Purchase ID: {purchase.id}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={
                          purchase.status === "reversed"
                            ? "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800"
                            : purchase.status === "paid"
                              ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800"
                              : "rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800"
                        }
                      >
                        {purchase.status}
                      </span>
                      <p className="mt-2 text-sm text-slate-600">
                        Allocated{" "}
                        {formatOriginal(
                          purchase.currency,
                          purchase.allocatedOriginalAmount,
                        )}
                      </p>
                    </div>
                  </div>

                  <dl className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-3">
                    <div>
                      <dt className="text-xs font-semibold uppercase text-slate-500">
                        Historical rate
                      </dt>
                      <dd className="mt-1 font-semibold text-slate-900">
                        {purchase.purchaseExchangeRate
                          ? `${purchase.purchaseExchangeRate} RON/USD`
                          : "RON purchase"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase text-slate-500">
                        Historical inventory cost
                      </dt>
                      <dd className="mt-1 font-semibold text-slate-900">
                        {formatRON(parseMoneyInput(purchase.inventoryCostRon))}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase text-slate-500">
                        Remaining historical cost
                      </dt>
                      <dd className="mt-1 font-semibold text-slate-900">
                        {formatRON(
                          parseMoneyInput(purchase.remainingHistoricalRon),
                        )}
                      </dd>
                    </div>
                  </dl>

                  {purchase.description ? (
                    <p className="mt-3 text-sm text-slate-700">
                      {purchase.description}
                    </p>
                  ) : null}
                  {purchase.reversalReason ? (
                    <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900">
                      Reversal: {purchase.reversalReason}
                    </p>
                  ) : null}

                  <div className="mt-4 rounded-xl border border-slate-200 p-4">
                    <h3 className="text-sm font-bold text-slate-900">
                      Payment allocation trace
                    </h3>
                    {purchaseAllocations.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-500">
                        No payment allocations reference this purchase.
                      </p>
                    ) : (
                      <ul className="mt-3 space-y-3">
                        {purchaseAllocations.map((allocation) => (
                          <li
                            className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700"
                            key={allocation.id}
                          >
                            <div className="flex flex-wrap justify-between gap-2">
                              <span>
                                Payment {allocation.paymentDate} ·{" "}
                                {allocation.paymentStatus}
                              </span>
                              <strong>
                                {formatOriginal(
                                  allocation.currency,
                                  allocation.allocatedOriginalAmount,
                                )}
                              </strong>
                            </div>
                            <p className="mt-2 text-xs text-slate-600">
                              Payment rate{" "}
                              {allocation.paymentExchangeRate
                                ? `${allocation.paymentExchangeRate} RON/USD`
                                : "RON"}
                              {" · "}Historical{" "}
                              {formatRON(
                                parseMoneyInput(allocation.historicalRonValue),
                              )}
                              {" · "}Actual{" "}
                              {formatRON(
                                parseMoneyInput(allocation.actualRonValue),
                              )}
                              {" · "}Result (+ gain / - loss){" "}
                              {formatSignedRON(
                                parseMoneyInput(allocation.currencyGainLossRon),
                              )}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-bold text-slate-950">Payment history</h2>
        <p className="mt-2 text-sm text-slate-600">
          Reversed payments remain visible but do not reduce active debt.
          Current outstanding to pay is shown before the payment list.
        </p>
        {report.rows.length === 0 ? (
          <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
            This supplier has no active outstanding balance.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {report.rows.map((row) => (
              <article
                className="rounded-2xl bg-amber-50 p-4"
                key={`payment-outstanding-${row.currency}`}
              >
                <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  {row.currency} outstanding to pay
                </h3>
                <p className="mt-2 text-xl font-bold text-amber-950">
                  {formatOriginal(row.currency, row.remainingOriginalAmount)}
                </p>
                <p className="mt-1 text-xs text-amber-800">
                  Estimated RON:{" "}
                  {row.estimatedRemainingRon
                    ? formatRON(row.estimatedRemainingRon)
                    : "Unavailable"}
                </p>
              </article>
            ))}
          </div>
        )}
        {payments.length === 0 ? (
          <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
            No payments were recorded {historyScope}.
          </p>
        ) : (
          <ul className="mt-5 max-h-[38rem] space-y-4 overflow-y-auto overscroll-contain pr-2">
            {payments.map((payment) => (
              <li
                className="rounded-2xl border border-slate-200 p-5"
                key={payment.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-bold text-slate-950">
                      {formatOriginal(
                        payment.currency,
                        payment.originalAmountPaid,
                      )}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {payment.paymentDate} · {payment.financialAccountName} ·{" "}
                      {payment.allocationStrategy.replace("_", " ")}
                    </p>
                    <p className="mt-1 break-all text-xs text-slate-400">
                      Payment ID: {payment.id}
                    </p>
                  </div>
                  <span
                    className={
                      payment.status === "active"
                        ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800"
                        : "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800"
                    }
                  >
                    {payment.status}
                  </span>
                </div>
                <dl className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs font-semibold uppercase text-slate-500">
                      Payment rate
                    </dt>
                    <dd className="mt-1 font-semibold">
                      {payment.paymentExchangeRate
                        ? `${payment.paymentExchangeRate} RON/USD`
                        : "RON payment"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-slate-500">
                      Actual account effect
                    </dt>
                    <dd className="mt-1 font-semibold">
                      {formatRON(parseMoneyInput(payment.actualAmountRon))}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-slate-500">
                      Currency result (+ gain / - loss)
                    </dt>
                    <dd className="mt-1 font-semibold">
                      {formatSignedRON(
                        parseMoneyInput(payment.currencyGainLossRon),
                      )}
                    </dd>
                  </div>
                </dl>
                <ul className="mt-4 space-y-2">
                  {payment.allocations.map((allocation) => (
                    <li
                      className="flex flex-wrap justify-between gap-2 text-sm"
                      key={allocation.id}
                    >
                      <a
                        className="font-medium text-teal-700 hover:text-teal-900"
                        href={`#supplier-purchase-${allocation.purchaseId}`}
                      >
                        Purchase {allocation.purchaseDate}
                      </a>
                      <span className="font-semibold text-slate-700">
                        {formatOriginal(
                          allocation.currency,
                          allocation.allocatedOriginalAmount,
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                {payment.notes ? (
                  <p className="mt-3 text-sm text-slate-700">{payment.notes}</p>
                ) : null}
                {payment.reversalReason ? (
                  <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900">
                    Reversal: {payment.reversalReason}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
