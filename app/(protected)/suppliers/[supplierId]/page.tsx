import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CollapsiblePanel } from "@/components/collapsible-panel";
import { SupplierDeactivationForm } from "@/components/supplier-deactivation-form";
import { SupplierForm } from "@/components/supplier-form";
import { SupplierPaymentForm } from "@/components/supplier-payment-form";
import { SupplierPaymentReversalForm } from "@/components/supplier-payment-reversal-form";
import { SupplierPurchaseForm } from "@/components/supplier-purchase-form";
import { SupplierPurchaseReversalForm } from "@/components/supplier-purchase-reversal-form";
import { HistoryPeriodFilter } from "@/components/history-period-filter";
import {
  redirectEmployeeToDailySales,
  requireBusinessMember,
} from "@/lib/auth/session";
import { formatInstantInBusinessTimeZone } from "@/lib/date/business-date";
import { resolveHistoryPeriod } from "@/lib/date/history-date";
import {
  formatRON,
  formatSignedRON,
  formatUSD,
  parseMoneyInput,
} from "@/lib/money/money";
import { supplierIdSchema } from "@/lib/validation/suppliers";
import { getBusinessDays, getOpenBusinessDay } from "@/services/business-days";
import {
  getSupplierFinancialAccountOptions,
  getSupplierPayments,
} from "@/services/supplier-payments";
import {
  getInventoryLocationOptions,
  getSupplierPayableBalances,
  getSupplierPurchases,
} from "@/services/supplier-purchases";
import { searchProducts } from "@/services/products";
import { getSupplier } from "@/services/suppliers";

const successMessages: Readonly<Record<string, string>> = {
  created: "Supplier created.",
  updated: "Supplier details updated.",
  deactivated: "Supplier deactivated without deleting its purchase history.",
  purchaseCreated:
    "Products received; payable, inventory value, and stock quantities increased.",
  purchaseReversed:
    "Supplier purchase reversed; payable and inventory effects were removed.",
  paymentCreated:
    "Supplier payment recorded, allocated, and removed from the selected account.",
  paymentReversed:
    "Supplier payment reversed; payable and account balance were restored.",
};

function formatOriginalAmount(currency: "RON" | "USD", amount: string) {
  const parsed = parseMoneyInput(amount);
  return currency === "USD" ? formatUSD(parsed) : formatRON(parsed);
}

export default async function SupplierDetailsPage({
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

  const historyPeriod = resolveHistoryPeriod(query, context.business.timezone);
  const [
    supplier,
    purchases,
    outstandingPurchases,
    payableBalances,
    openDay,
    businessDays,
    locations,
    products,
    accounts,
    payments,
  ] = await Promise.all([
    getSupplier(context, idResult.data),
    getSupplierPurchases(context, idResult.data, historyPeriod),
    getSupplierPurchases(context, idResult.data),
    getSupplierPayableBalances(context, idResult.data),
    getOpenBusinessDay(context.business.id),
    getBusinessDays(context, 1000),
    getInventoryLocationOptions(context),
    searchProducts(context, {
      query: "",
      categoryId: null,
      includeInactive: false,
    }),
    getSupplierFinancialAccountOptions(context),
    getSupplierPayments(context, idResult.data, historyPeriod),
  ]);

  if (!supplier) {
    notFound();
  }

  const resultKey = Object.keys(successMessages).find(
    (key) => query[key] === "1",
  );

  return (
    <div className="space-y-6">
      <Link
        className="inline-flex text-sm font-semibold text-teal-700 hover:text-teal-900"
        href="/suppliers"
      >
        ← Back to suppliers
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
              Supplier details
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
              {supplier.name}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Default currency: {supplier.defaultCurrency ?? "Not set"}
            </p>
          </div>
          <span
            className={
              supplier.isActive
                ? "rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800"
                : "rounded-full bg-slate-200 px-3 py-1 text-sm font-semibold text-slate-700"
            }
          >
            {supplier.isActive ? "Active" : "Inactive"}
          </span>
        </div>
        <p className="mt-4 text-sm text-slate-500">
          Last updated{" "}
          {formatInstantInBusinessTimeZone(
            supplier.updatedAt,
            context.business.timezone,
          )}
        </p>

        <div className="mt-8 max-w-2xl">
          <SupplierForm supplier={supplier} />
        </div>
      </section>

      <HistoryPeriodFilter
        action={`/suppliers/${supplier.id}`}
        anchor="supplier-purchase-history"
        error={historyPeriod.error}
        fromDate={historyPeriod.fromDate}
        toDate={historyPeriod.toDate}
      />

      <CollapsiblePanel
        description={`Purchases from ${historyPeriod.fromDate} to ${historyPeriod.toDate}.`}
        id="supplier-purchase-history"
        title="Supplier purchases"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
              Payable and inventory
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">
              Supplier purchases
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Each purchase increases the supplier payable and the selected
              inventory location. It does not reduce cash or bank.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {payableBalances.length === 0 ? (
              <div className="rounded-2xl bg-slate-100 px-5 py-3 text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Outstanding
                </p>
                <p className="mt-1 text-xl font-bold text-slate-950">None</p>
              </div>
            ) : (
              payableBalances.map((balance) => (
                <div
                  className="rounded-2xl bg-teal-50 px-5 py-3 text-right"
                  key={balance.currency}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                    {balance.currency} outstanding
                  </p>
                  <p className="mt-1 text-xl font-bold text-teal-950">
                    {formatOriginalAmount(
                      balance.currency,
                      balance.outstandingOriginalAmount,
                    )}
                  </p>
                  <p className="mt-1 text-xs text-teal-800">
                    Historical cost{" "}
                    {formatRON(parseMoneyInput(balance.historicalRonAmount))}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {supplier.isActive ? (
          <div className="mt-8 max-w-2xl rounded-2xl border border-slate-200 p-5">
            <h3 className="text-lg font-bold text-slate-950">
              Record goods received
            </h3>
            <div className="mt-5">
              <SupplierPurchaseForm
                businessDays={businessDays}
                defaultCurrency={supplier.defaultCurrency}
                locations={locations}
                openDay={openDay}
                products={products}
                requestId={randomUUID()}
                role={context.role}
                supplierId={supplier.id}
              />
            </div>
          </div>
        ) : (
          <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
            This supplier is inactive and cannot receive new purchases.
          </p>
        )}

        <div className="mt-8">
          <h3 className="text-lg font-bold text-slate-950">Purchase history</h3>
          {purchases.length === 0 ? (
            <p className="mt-3 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
              No purchases were recorded from {historyPeriod.fromDate} to{" "}
              {historyPeriod.toDate}.
            </p>
          ) : (
            <ul className="mt-3 max-h-[38rem] space-y-3 overflow-y-auto overscroll-contain pr-2">
              {purchases.map((purchase) => (
                <li
                  className="scroll-mt-6 rounded-2xl border border-slate-200 p-5"
                  id={`supplier-purchase-${purchase.id}`}
                  key={purchase.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-slate-950">
                        {formatOriginalAmount(
                          purchase.currency,
                          purchase.originalAmount,
                        )}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Purchase date: {purchase.purchaseDate}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Inventory destination:{" "}
                        {purchase.destinationLocationName ?? "Opening payable"}
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
                        Inventory cost:{" "}
                        {formatRON(parseMoneyInput(purchase.inventoryCostRon))}
                      </p>
                      {purchase.status === "partial" ? (
                        <p className="mt-1 text-sm font-semibold text-slate-700">
                          Remaining:{" "}
                          {formatOriginalAmount(
                            purchase.currency,
                            purchase.remainingOriginalAmount,
                          )}
                        </p>
                      ) : null}
                      {purchase.purchaseExchangeRate ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Historical rate: {purchase.purchaseExchangeRate} RON
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {purchase.description ? (
                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {purchase.description}
                    </p>
                  ) : null}
                  {purchase.lines.length > 0 ? (
                    <div className="mt-4 overflow-x-auto rounded-xl bg-slate-50 p-3">
                      <table className="w-full min-w-[36rem] text-left text-sm">
                        <thead className="text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-2 py-2">Product</th>
                            <th className="px-2 py-2 text-right">Quantity</th>
                            <th className="px-2 py-2 text-right">Unit price</th>
                            <th className="px-2 py-2 text-right">
                              Historical cost
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {purchase.lines.map((line) => (
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
                              <td className="px-2 py-3 text-right font-semibold">
                                {line.quantity}
                              </td>
                              <td className="px-2 py-3 text-right">
                                {formatOriginalAmount(
                                  purchase.currency,
                                  line.unitPriceOriginalCurrency,
                                )}
                              </td>
                              <td className="px-2 py-3 text-right font-semibold">
                                {formatRON(parseMoneyInput(line.lineTotalRon))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-600">
                      Historical value-only purchase — product quantities were
                      not recorded in Phase 1.
                    </p>
                  )}
                  {purchase.reversalReason ? (
                    <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900">
                      Reversal reason: {purchase.reversalReason}
                    </p>
                  ) : null}
                  {context.role === "admin" &&
                  purchase.status === "unpaid" &&
                  purchase.entryOrigin !== "opening_balance" ? (
                    <SupplierPurchaseReversalForm
                      purchaseId={purchase.id}
                      supplierId={supplier.id}
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
        title="Supplier payments"
      >
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
          Money paid
        </p>
        <h2 className="mt-2 text-2xl font-bold text-slate-950">
          Supplier payments
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Payments reduce outstanding purchases and the selected cash or bank
          account. A positive USD currency result is a gain; a negative result
          is a loss compared with the purchase&apos;s historical rate.
        </p>

        <div className="mt-8 max-w-2xl rounded-2xl border border-slate-200 p-5">
          <h3 className="text-lg font-bold text-slate-950">Record payment</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Automatic allocation pays the oldest outstanding purchase in the
            selected currency first.
          </p>
          <div className="mt-5">
            <SupplierPaymentForm
              accounts={accounts}
              businessDays={businessDays}
              defaultCurrency={supplier.defaultCurrency}
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
                  currency: purchase.currency,
                  remainingOriginalAmount: purchase.remainingOriginalAmount,
                  purchaseExchangeRate: purchase.purchaseExchangeRate,
                  description: purchase.description,
                }))}
              requestId={randomUUID()}
              role={context.role}
              supplierId={supplier.id}
            />
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-lg font-bold text-slate-950">Payment history</h3>
          {payments.length === 0 ? (
            <p className="mt-3 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
              No supplier payments were recorded from {historyPeriod.fromDate}{" "}
              to {historyPeriod.toDate}.
            </p>
          ) : (
            <ul className="mt-3 max-h-[38rem] space-y-3 overflow-y-auto overscroll-contain pr-2">
              {payments.map((payment) => (
                <li
                  className="scroll-mt-6 rounded-2xl border border-slate-200 p-5"
                  id={`supplier-payment-${payment.id}`}
                  key={payment.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-slate-950">
                        {formatOriginalAmount(
                          payment.currency,
                          payment.originalAmountPaid,
                        )}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {payment.paymentDate} · {payment.financialAccountName}
                      </p>
                      <p className="mt-1 text-xs capitalize text-slate-500">
                        {payment.allocationStrategy.replace("_", " ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={
                          payment.status === "active"
                            ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800"
                            : "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800"
                        }
                      >
                        {payment.status}
                      </span>
                      <p className="mt-2 text-sm font-semibold text-slate-700">
                        Account effect:{" "}
                        {formatRON(parseMoneyInput(payment.actualAmountRon))}
                      </p>
                      {payment.currency === "USD" ? (
                        <>
                          <p className="mt-1 text-xs text-slate-500">
                            Payment rate: {payment.paymentExchangeRate} RON
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-700">
                            Currency result (+ gain / - loss):{" "}
                            {formatSignedRON(
                              parseMoneyInput(payment.currencyGainLossRon),
                            )}
                          </p>
                        </>
                      ) : null}
                    </div>
                  </div>
                  {payment.notes ? (
                    <p className="mt-3 text-sm text-slate-700">
                      {payment.notes}
                    </p>
                  ) : null}
                  <ul className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3">
                    {payment.allocations.map((allocation) => (
                      <li
                        className="flex flex-wrap justify-between gap-3 text-sm text-slate-700"
                        key={allocation.id}
                      >
                        <span>Purchase {allocation.purchaseDate}</span>
                        <span className="font-semibold">
                          {formatOriginalAmount(
                            allocation.currency,
                            allocation.allocatedOriginalAmount,
                          )}
                          {" · "}
                          {formatRON(
                            parseMoneyInput(allocation.actualRonValue),
                          )}{" "}
                          paid
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
                    <SupplierPaymentReversalForm
                      paymentId={payment.id}
                      supplierId={supplier.id}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CollapsiblePanel>

      {context.role === "admin" && supplier.isActive ? (
        <SupplierDeactivationForm supplierId={supplier.id} />
      ) : null}
    </div>
  );
}
