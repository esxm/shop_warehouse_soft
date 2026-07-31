import { OpeningBalanceWizard } from "@/components/opening-balance-wizard";
import { OpeningBalanceReversalForm } from "@/components/opening-balance-reversal-form";
import { requireAdmin } from "@/lib/auth/session";
import { formatRON, parseMoneyInput } from "@/lib/money/money";
import { getTodayInBusinessTimeZone } from "@/lib/date/business-date";
import { getOpeningBalanceSummary } from "@/services/opening-balances";

export default async function OpeningBalancesPage() {
  const context = await requireAdmin();
  const summary = await getOpeningBalanceSummary(context);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
        Administrator setup
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
        Opening Balances
      </h1>
      <p className="mt-3 max-w-3xl leading-7 text-slate-600">
        Initialize account balances, inventory values, receivables, and payables
        as immutable opening transactions.
      </p>

      {summary ? (
        <div className="mt-8">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
            <h2 className="font-bold">Opening setup is complete</h2>
            <p className="mt-1 text-sm">
              Opening date: {summary.openingDate}. Direct editing and duplicate
              setup are blocked.
            </p>
          </div>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Cash", formatRON(parseMoneyInput(summary.cashBalanceRon))],
              ["Bank", formatRON(parseMoneyInput(summary.bankBalanceRon))],
              [
                "Warehouse",
                formatRON(parseMoneyInput(summary.warehouseInventoryRon)),
              ],
              ["Shop", formatRON(parseMoneyInput(summary.shopInventoryRon))],
            ].map(([label, value]) => (
              <div className="rounded-2xl bg-slate-50 p-4" key={label}>
                <dt className="text-sm text-slate-500">{label}</dt>
                <dd className="mt-1 text-lg font-bold text-slate-950">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-sm text-slate-600">
            {summary.customerReceivableCount} customer receivable(s) and{" "}
            {summary.supplierPayableCount} supplier payable(s) were initialized.
          </p>
          <OpeningBalanceReversalForm batchId={summary.id} />
        </div>
      ) : (
        <OpeningBalanceWizard
          defaultOpeningDate={getTodayInBusinessTimeZone(
            context.business.timezone,
          )}
        />
      )}
    </section>
  );
}
