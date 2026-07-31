import Link from "next/link";
import { notFound } from "next/navigation";

import { HistoryPeriodFilter } from "@/components/history-period-filter";
import { ReportNavigation } from "@/components/report-navigation";
import {
  redirectEmployeeToDailySales,
  requireBusinessMember,
} from "@/lib/auth/session";
import {
  getTodayInBusinessTimeZone,
  type BusinessDate,
} from "@/lib/date/business-date";
import { resolveHistoryPeriod } from "@/lib/date/history-date";
import { formatRON, parseMoneyInput } from "@/lib/money/money";
import { buildCustomerReceivablesReport } from "@/lib/reports/customer-receivables";
import { customerIdSchema } from "@/lib/validation/customers";
import { getCustomerCreditPurchases } from "@/services/customer-credit-purchases";
import { getCustomerPayments } from "@/services/customer-payments";
import { getCustomer } from "@/services/customers";

export default async function CustomerReceivableTracePage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ customerId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const context = await requireBusinessMember();
  redirectEmployeeToDailySales(context);
  const [{ customerId: rawCustomerId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const idResult = customerIdSchema.safeParse(rawCustomerId);

  if (!idResult.success) {
    notFound();
  }

  const historyPeriod = resolveHistoryPeriod(query, context.business.timezone);
  const [customer, allPurchases, purchases, payments] = await Promise.all([
    getCustomer(context, idResult.data),
    getCustomerCreditPurchases(context, idResult.data),
    getCustomerCreditPurchases(context, idResult.data, historyPeriod),
    getCustomerPayments(context, idResult.data, historyPeriod),
  ]);

  if (!customer) {
    notFound();
  }

  const asOfDate: BusinessDate = getTodayInBusinessTimeZone(
    context.business.timezone,
  );
  const report = buildCustomerReceivablesReport(
    allPurchases.map((purchase) => ({
      purchaseId: purchase.id,
      customerId: purchase.customerId,
      customerName: customer.name,
      purchaseDate: purchase.purchaseDate,
      dueDate: purchase.dueDate,
      amountRon: purchase.amountRon,
      allocatedRon: purchase.allocatedRon,
      remainingRon: purchase.remainingRon,
      status: purchase.status,
    })),
    {
      customerId: customer.id,
      outstandingOnly: false,
      overdueOnly: false,
      fromDate: null,
      toDate: null,
    },
    asOfDate,
  );
  const summary = report.rows[0] ?? {
    customerId: customer.id,
    customerName: customer.name,
    totalPurchasesRon: parseMoneyInput("0"),
    totalPaymentsRon: parseMoneyInput("0"),
    remainingBalanceRon: parseMoneyInput("0"),
    overdueAmountRon: parseMoneyInput("0"),
    oldestUnpaidDate: null,
  };
  const allocationTraces = payments.flatMap((payment) =>
    payment.allocations.map((allocation) => ({
      ...allocation,
      paymentDate: payment.paymentDate,
      paymentStatus: payment.status,
    })),
  );

  return (
    <div className="space-y-6">
      <ReportNavigation />

      <Link
        className="inline-flex text-sm font-semibold text-teal-700 hover:text-teal-900"
        href="/reports/receivables"
      >
        ← Back to customer receivables
      </Link>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
              Receivable trace
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
              {customer.name}
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              Every purchase, payment, and allocation remains visible, including
              reversed history.
            </p>
          </div>
          <Link
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            href={`/customers/${customer.id}`}
          >
            Open customer operations
          </Link>
        </div>

        <dl className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Active purchases
            </dt>
            <dd className="mt-2 text-xl font-bold text-slate-950">
              {formatRON(summary.totalPurchasesRon)}
            </dd>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Active allocations
            </dt>
            <dd className="mt-2 text-xl font-bold text-slate-950">
              {formatRON(summary.totalPaymentsRon)}
            </dd>
          </div>
          <div className="rounded-2xl bg-teal-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-teal-700">
              Remaining
            </dt>
            <dd className="mt-2 text-xl font-bold text-teal-950">
              {formatRON(summary.remainingBalanceRon)}
            </dd>
          </div>
          <div className="rounded-2xl bg-amber-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Overdue as of {asOfDate}
            </dt>
            <dd className="mt-2 text-xl font-bold text-amber-950">
              {formatRON(summary.overdueAmountRon)}
            </dd>
          </div>
        </dl>
      </section>

      <HistoryPeriodFilter
        action={`/reports/receivables/${customer.id}`}
        anchor="credit-purchase-history"
        error={historyPeriod.error}
        fromDate={historyPeriod.fromDate}
        toDate={historyPeriod.toDate}
      />

      <section
        className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        id="credit-purchase-history"
      >
        <h2 className="text-2xl font-bold text-slate-950">
          Credit purchase history
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Remaining values include allocations from active payments only.
        </p>
        {purchases.length === 0 ? (
          <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
            No credit purchases were recorded from {historyPeriod.fromDate} to{" "}
            {historyPeriod.toDate}.
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
                  id={`purchase-${purchase.id}`}
                  key={purchase.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-slate-950">
                        {formatRON(parseMoneyInput(purchase.amountRon))}
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
                        {formatRON(parseMoneyInput(purchase.allocatedRon))}
                      </p>
                      <p className="mt-1 font-bold text-slate-950">
                        Remaining{" "}
                        {formatRON(parseMoneyInput(purchase.remainingRon))}
                      </p>
                    </div>
                  </div>
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
                  <div className="mt-4 rounded-xl bg-slate-50 p-4">
                    <h3 className="text-sm font-bold text-slate-900">
                      Allocation trace
                    </h3>
                    {purchaseAllocations.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-500">
                        No payment allocations reference this purchase.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {purchaseAllocations.map((allocation) => (
                          <li
                            className="flex flex-wrap justify-between gap-2 text-sm text-slate-700"
                            key={allocation.id}
                          >
                            <span>
                              Payment {allocation.paymentDate} ·{" "}
                              {allocation.paymentStatus}
                            </span>
                            <span className="font-semibold">
                              {formatRON(parseMoneyInput(allocation.amountRon))}
                            </span>
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
          Reversed payments remain visible but their allocations do not reduce
          the active receivable.
        </p>
        {payments.length === 0 ? (
          <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
            No customer payments were recorded from {historyPeriod.fromDate} to{" "}
            {historyPeriod.toDate}.
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
                      {formatRON(parseMoneyInput(payment.amountRon))}
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
                <div className="mt-4 rounded-xl bg-slate-50 p-4">
                  <h3 className="text-sm font-bold text-slate-900">
                    Allocated purchases
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {payment.allocations.map((allocation) => (
                      <li
                        className="flex flex-wrap justify-between gap-2 text-sm"
                        key={allocation.id}
                      >
                        <a
                          className="font-medium text-teal-700 hover:text-teal-900"
                          href={`#purchase-${allocation.purchaseId}`}
                        >
                          Purchase {allocation.purchaseDate}
                        </a>
                        <span className="font-semibold text-slate-700">
                          {formatRON(parseMoneyInput(allocation.amountRon))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
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
