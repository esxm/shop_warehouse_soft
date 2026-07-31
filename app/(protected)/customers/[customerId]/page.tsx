import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CollapsiblePanel } from "@/components/collapsible-panel";
import { CustomerCreditPurchaseForm } from "@/components/customer-credit-purchase-form";
import { CustomerCreditPurchaseReversalForm } from "@/components/customer-credit-purchase-reversal-form";
import { CustomerDeactivationForm } from "@/components/customer-deactivation-form";
import { CustomerForm } from "@/components/customer-form";
import { CustomerPaymentForm } from "@/components/customer-payment-form";
import { CustomerPaymentReversalForm } from "@/components/customer-payment-reversal-form";
import { HistoryPeriodFilter } from "@/components/history-period-filter";
import {
  redirectEmployeeToDailySales,
  requireBusinessMember,
} from "@/lib/auth/session";
import { formatInstantInBusinessTimeZone } from "@/lib/date/business-date";
import { resolveHistoryPeriod } from "@/lib/date/history-date";
import { formatRON, parseMoneyInput } from "@/lib/money/money";
import { customerIdSchema } from "@/lib/validation/customers";
import { getBusinessDays, getOpenBusinessDay } from "@/services/business-days";
import {
  getCustomerCreditPurchases,
  getCustomerReceivableBalance,
} from "@/services/customer-credit-purchases";
import {
  getCustomerPayments,
  getFinancialAccountOptions,
} from "@/services/customer-payments";
import { getCustomer } from "@/services/customers";
import { getProductSaleOptions } from "@/services/product-sales";

const successMessages: Readonly<Record<string, string>> = {
  created: "Customer created.",
  updated: "Customer details updated.",
  deactivated: "Customer deactivated without deleting its history.",
  purchaseCreated: "Customer credit purchase recorded.",
  purchaseReversed:
    "Customer credit purchase reversed; the original remains in history.",
  paymentCreated:
    "Customer payment recorded, allocated, and added to the selected account.",
  paymentReversed:
    "Customer payment reversed; receivables and account balance were restored.",
};

export default async function CustomerDetailsPage({
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
  const [
    customer,
    purchases,
    outstandingPurchases,
    outstandingRon,
    openDay,
    businessDays,
    accounts,
    payments,
    creditProducts,
  ] = await Promise.all([
    getCustomer(context, idResult.data),
    getCustomerCreditPurchases(context, idResult.data, historyPeriod),
    getCustomerCreditPurchases(context, idResult.data),
    getCustomerReceivableBalance(context, idResult.data),
    getOpenBusinessDay(context.business.id),
    getBusinessDays(context, 1000),
    getFinancialAccountOptions(context),
    getCustomerPayments(context, idResult.data, historyPeriod),
    getProductSaleOptions(context),
  ]);

  if (!customer) {
    notFound();
  }

  const resultKey = Object.keys(successMessages).find(
    (key) => query[key] === "1",
  );

  return (
    <div className="space-y-6">
      <Link
        className="inline-flex text-sm font-semibold text-teal-700 hover:text-teal-900"
        href="/customers"
      >
        ← Back to customers
      </Link>

      {resultKey ? (
        <p
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-950"
          role="status"
        >
          {successMessages[resultKey]}
        </p>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
              Customer details
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
              {customer.name}
            </h1>
          </div>
          <span
            className={
              customer.isActive
                ? "rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800"
                : "rounded-full bg-slate-200 px-3 py-1 text-sm font-semibold text-slate-700"
            }
          >
            {customer.isActive ? "Active" : "Inactive"}
          </span>
        </div>
        <p className="mt-4 text-sm text-slate-500">
          Last updated{" "}
          {formatInstantInBusinessTimeZone(
            customer.updatedAt,
            context.business.timezone,
          )}
        </p>

        <div className="mt-8 max-w-2xl">
          <CustomerForm customer={customer} />
        </div>
      </section>

      <HistoryPeriodFilter
        action={`/customers/${customer.id}`}
        anchor="customer-purchase-history"
        error={historyPeriod.error}
        fromDate={historyPeriod.fromDate}
        toDate={historyPeriod.toDate}
      />

      <CollapsiblePanel
        description={`Purchases from ${historyPeriod.fromDate} to ${historyPeriod.toDate}.`}
        id="customer-purchase-history"
        title="Credit purchases"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
              Receivable
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">
              Credit purchases
            </h2>
          </div>
          <div className="rounded-2xl bg-teal-50 px-5 py-3 text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
              Outstanding
            </p>
            <p className="mt-1 text-xl font-bold text-teal-950">
              {formatRON(parseMoneyInput(outstandingRon))}
            </p>
          </div>
        </div>

        {customer.isActive ? (
          <div className="mt-8 max-w-2xl rounded-2xl border border-slate-200 p-5">
            <h3 className="text-lg font-bold text-slate-950">
              Record credit purchase
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This increases the customer receivable. It does not create a cash
              or bank entry.
            </p>
            <div className="mt-5">
              <CustomerCreditPurchaseForm
                businessDays={businessDays}
                customerId={customer.id}
                openDay={openDay}
                products={creditProducts}
                requestId={randomUUID()}
                role={context.role}
              />
            </div>
          </div>
        ) : (
          <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
            This customer is inactive and cannot receive new credit purchases.
          </p>
        )}

        <div className="mt-8">
          <h3 className="text-lg font-bold text-slate-950">Purchase history</h3>
          {purchases.length === 0 ? (
            <p className="mt-3 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
              No credit purchases were recorded from {historyPeriod.fromDate} to{" "}
              {historyPeriod.toDate}.
            </p>
          ) : (
            <ul className="mt-3 max-h-[38rem] space-y-3 overflow-y-auto overscroll-contain pr-2">
              {purchases.map((purchase) => (
                <li
                  className="scroll-mt-6 rounded-2xl border border-slate-200 p-5"
                  id={`customer-credit-purchase-${purchase.id}`}
                  key={purchase.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-slate-950">
                        {formatRON(parseMoneyInput(purchase.amountRon))}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Purchase date: {purchase.purchaseDate}
                      </p>
                      {purchase.dueDate ? (
                        <p className="mt-1 text-sm text-slate-500">
                          Due date: {purchase.dueDate}
                        </p>
                      ) : null}
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
                      <p className="mt-2 text-sm font-semibold text-slate-700">
                        Remaining:{" "}
                        {formatRON(parseMoneyInput(purchase.remainingRon))}
                      </p>
                    </div>
                  </div>
                  {purchase.description ? (
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {purchase.description}
                    </p>
                  ) : null}
                  {purchase.reversalReason ? (
                    <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900">
                      Reversal reason: {purchase.reversalReason}
                    </p>
                  ) : null}
                  {context.role === "admin" &&
                  purchase.status === "unpaid" &&
                  purchase.entryOrigin !== "opening_balance" ? (
                    <CustomerCreditPurchaseReversalForm
                      customerId={customer.id}
                      purchaseId={purchase.id}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel
        description={`Payments from ${historyPeriod.fromDate} to ${historyPeriod.toDate}.`}
        title="Customer payments"
      >
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Money received
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">
            Customer payments
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Payments reduce receivables and increase cash or bank. They never
            create new revenue.
          </p>
        </div>

        <div className="mt-8 max-w-2xl rounded-2xl border border-slate-200 p-5">
          <h3 className="text-lg font-bold text-slate-950">Record payment</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Automatic allocation pays the oldest outstanding purchase first.
          </p>
          <div className="mt-5">
            <CustomerPaymentForm
              accounts={accounts}
              businessDays={businessDays}
              customerId={customer.id}
              openDay={openDay}
              outstandingPurchases={outstandingPurchases
                .filter(
                  (purchase) =>
                    purchase.status === "unpaid" ||
                    purchase.status === "partial",
                )
                .map((purchase) => ({
                  id: purchase.id,
                  purchaseDate: purchase.purchaseDate,
                  remainingRon: purchase.remainingRon,
                  description: purchase.description,
                }))}
              requestId={randomUUID()}
              role={context.role}
            />
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-lg font-bold text-slate-950">Payment history</h3>
          {payments.length === 0 ? (
            <p className="mt-3 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
              No customer payments were recorded from {historyPeriod.fromDate}{" "}
              to {historyPeriod.toDate}.
            </p>
          ) : (
            <ul className="mt-3 max-h-[38rem] space-y-3 overflow-y-auto overscroll-contain pr-2">
              {payments.map((payment) => (
                <li
                  className="scroll-mt-6 rounded-2xl border border-slate-200 p-5"
                  id={`customer-payment-${payment.id}`}
                  key={payment.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-slate-950">
                        {formatRON(parseMoneyInput(payment.amountRon))}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {payment.paymentDate} · {payment.financialAccountName}
                      </p>
                      <p className="mt-1 text-xs capitalize text-slate-500">
                        {payment.allocationStrategy.replace("_", " ")}
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
                  {payment.notes ? (
                    <p className="mt-3 text-sm text-slate-700">
                      {payment.notes}
                    </p>
                  ) : null}
                  <ul className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3">
                    {payment.allocations.map((allocation) => (
                      <li
                        className="flex justify-between gap-3 text-sm text-slate-700"
                        key={allocation.id}
                      >
                        <span>Purchase {allocation.purchaseDate}</span>
                        <span className="font-semibold">
                          {formatRON(parseMoneyInput(allocation.amountRon))}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {payment.reversalReason ? (
                    <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900">
                      Reversal reason: {payment.reversalReason}
                    </p>
                  ) : null}
                  {context.role === "admin" && payment.status === "active" ? (
                    <CustomerPaymentReversalForm
                      customerId={customer.id}
                      paymentId={payment.id}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CollapsiblePanel>

      {context.role === "admin" && customer.isActive ? (
        <CustomerDeactivationForm customerId={customer.id} />
      ) : null}
    </div>
  );
}
