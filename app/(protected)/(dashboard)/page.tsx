import Link from "next/link";
import { redirect } from "next/navigation";

import { UsdReferenceRateForm } from "@/components/usd-reference-rate-form";
import { requireBusinessMember } from "@/lib/auth/session";
import { formatRON, formatUSD, type MoneyAmount } from "@/lib/money/money";
import { getDashboardData } from "@/services/dashboard";

type MetricCardProps = Readonly<{
  label: string;
  value: MoneyAmount | null;
  detail?: string;
  emphasized?: boolean;
}>;

const quickActions = [
  { label: "Record daily sales", href: "/daily-sales" },
  { label: "New customer credit purchase", href: "/customers" },
  { label: "Customer payment", href: "/customers" },
  { label: "New supplier purchase", href: "/suppliers" },
  { label: "Supplier payment", href: "/suppliers" },
  { label: "Expense", href: "/expenses" },
  { label: "Move products", href: "/stock#record-movement" },
] as const;

function MetricCard({
  label,
  value,
  detail,
  emphasized = false,
}: MetricCardProps) {
  return (
    <article
      className={
        emphasized
          ? "rounded-2xl bg-slate-950 p-5 text-white shadow-sm"
          : "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      }
    >
      <h2
        className={
          emphasized
            ? "text-xs font-semibold uppercase tracking-wide text-slate-300"
            : "text-xs font-semibold uppercase tracking-wide text-slate-500"
        }
      >
        {label}
      </h2>
      <p
        className={
          emphasized
            ? "mt-3 text-2xl font-bold tracking-tight text-white"
            : "mt-3 text-2xl font-bold tracking-tight text-slate-950"
        }
      >
        {value === null ? "Unavailable" : formatRON(value)}
      </p>
      {detail ? (
        <p
          className={
            emphasized
              ? "mt-2 text-xs leading-5 text-slate-300"
              : "mt-2 text-xs leading-5 text-slate-500"
          }
        >
          {detail}
        </p>
      ) : null}
    </article>
  );
}

export default async function DashboardPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const context = await requireBusinessMember();

  if (context.role === "employee") {
    redirect("/daily-sales");
  }

  const [query, dashboard] = await Promise.all([
    searchParams,
    getDashboardData(context),
  ]);
  const { metrics } = dashboard;
  const missingUsdRate =
    metrics.supplierPayablesUsd !== "0.00" &&
    dashboard.currentUsdRonRate === null;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-6 text-white shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-300">
          Current position
        </p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Business dashboard
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Revenue and balances are derived from closed sales and immutable
              ledgers as of {dashboard.asOfDate}.
            </p>
          </div>
          <Link
            className="inline-flex w-fit rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-950"
            href="/cash-and-bank"
          >
            View financial ledger
          </Link>
        </div>
      </section>

      {query.rateUpdated === "1" ? (
        <p
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-950"
          role="status"
        >
          USD/RON reference rate recorded. Dashboard estimates now use the
          latest effective rate.
        </p>
      ) : null}

      {!metrics.hasFinancialActivity ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          No financial activity has been recorded yet. The cards below show the
          current zero balances.
        </section>
      ) : null}

      {missingUsdRate ? (
        <section
          className="rounded-2xl border border-amber-300 bg-amber-50 p-5"
          role="alert"
        >
          <h2 className="font-bold text-amber-950">
            A current USD/RON rate is required
          </h2>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            Outstanding USD payables cannot be estimated in RON, so supplier
            payables and net business value are unavailable. An administrator
            must record a manual reference rate below.
          </p>
        </section>
      ) : null}

      <section aria-labelledby="dashboard-metrics-title">
        <h2 className="sr-only" id="dashboard-metrics-title">
          Current business metrics
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            detail="Closed daily-sales records only"
            label="Today's sales"
            value={metrics.todayRevenueRon}
          />
          <MetricCard
            detail="Closed sales from the current calendar month"
            label="Current month sales"
            value={metrics.currentMonthRevenueRon}
          />
          <MetricCard label="Cash" value={metrics.cashBalanceRon} />
          <MetricCard label="Bank" value={metrics.bankBalanceRon} />
          <MetricCard
            label="Customer receivables"
            value={metrics.customerReceivablesRon}
          />
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Supplier payables
            </h2>
            <p className="mt-3 text-xl font-bold text-slate-950">
              {formatRON(metrics.supplierPayablesRon)}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-700">
              {formatUSD(metrics.supplierPayablesUsd)}
            </p>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              {metrics.estimatedSupplierPayablesRon === null
                ? "Estimated RON total unavailable — current USD/RON rate missing."
                : `Estimated total ${formatRON(metrics.estimatedSupplierPayablesRon)}.`}
            </p>
          </article>
          <MetricCard
            detail="Exact product quantities at weighted historical cost"
            label="Product-valued inventory"
            value={metrics.productValuedInventoryRon}
          />
          <MetricCard
            detail="Cash + bank + receivables + product-valued inventory − estimated payables. Revenue is not added."
            emphasized
            label="Net business value"
            value={metrics.netBusinessValueRon}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.7fr)]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-2xl font-bold text-slate-950">Quick actions</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {quickActions.map((action) => (
              <Link
                className="flex min-h-11 items-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-teal-500 hover:bg-teal-50 hover:text-teal-950"
                href={action.href}
                key={action.label}
              >
                {action.label}
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-2xl font-bold text-slate-950">
            USD/RON reference
          </h2>
          {dashboard.currentUsdRonRate ? (
            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              <p className="text-2xl font-bold text-slate-950">
                {dashboard.currentUsdRonRate.rate} RON
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Effective {dashboard.currentUsdRonRate.effectiveDate}. Used only
                to estimate outstanding USD payables.
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-slate-600">
              No USD/RON reference rate has been entered. A rate is only
              required while USD payables are outstanding.
            </p>
          )}
          {context.role === "admin" ? (
            <UsdReferenceRateForm defaultEffectiveDate={dashboard.asOfDate} />
          ) : (
            <p className="mt-4 text-xs text-slate-500">
              Only administrators can record reference rates.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
