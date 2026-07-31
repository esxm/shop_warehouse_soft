import { BusinessPositionSnapshotForm } from "@/components/business-position-snapshot-form";
import { ReportNavigation } from "@/components/report-navigation";
import {
  redirectEmployeeToDailySales,
  requireBusinessMember,
} from "@/lib/auth/session";
import { formatInstantInBusinessTimeZone } from "@/lib/date/business-date";
import { formatRON, formatUSD, type MoneyAmount } from "@/lib/money/money";
import { businessPositionFilterSchema } from "@/lib/reports/business-position";
import { getBusinessPositionPageData } from "@/services/business-position-report";

function firstQueryValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function PositionCard({
  label,
  value,
  liability = false,
  estimated = false,
}: Readonly<{
  label: string;
  value: MoneyAmount | null;
  liability?: boolean;
  estimated?: boolean;
}>) {
  return (
    <article
      className={
        liability
          ? "rounded-2xl border border-red-200 bg-red-50 p-5"
          : "rounded-2xl border border-slate-200 bg-white p-5"
      }
    >
      <h2
        className={
          liability
            ? "text-xs font-semibold uppercase tracking-wide text-red-700"
            : "text-xs font-semibold uppercase tracking-wide text-slate-500"
        }
      >
        {label}
        {estimated ? " (estimated)" : ""}
      </h2>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
        {value === null ? "Unavailable" : formatRON(value)}
      </p>
    </article>
  );
}

export default async function BusinessPositionReportPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const context = await requireBusinessMember();
  redirectEmployeeToDailySales(context);
  const query = await searchParams;
  const filterResult = businessPositionFilterSchema.safeParse({
    usdRonRate: firstQueryValue(query.usdRonRate),
  });
  const requestedRate = filterResult.success
    ? filterResult.data.usdRonRate
    : null;
  const data = await getBusinessPositionPageData(context, requestedRate);
  const { position } = data;
  const missingRate =
    position.supplierPayablesUsd !== "0.00" && position.usdRonRate === null;
  const orderedTrend = [...data.trend].reverse();

  return (
    <div className="space-y-6">
      <ReportNavigation />

      <section className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-6 text-white shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-300">
          Current net value
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Business-position report
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Assets and supplier liabilities as of {data.asOfDate}. Revenue is not
          added separately because its effects already appear in cash, bank,
          receivables, inventory, and liabilities.
        </p>
      </section>

      {query.snapshotSaved === "1" ? (
        <p
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-950"
          role="status"
        >
          Today&apos;s immutable business-position snapshot was saved.
        </p>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-bold text-slate-950">
          USD/RON valuation rate
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Select a saved reference rate from the suggestions or enter a current
          rate. This changes only the estimated RON value of outstanding USD
          supplier debt.
        </p>
        <form
          className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"
          method="get"
        >
          <label className="flex-1 text-sm font-semibold text-slate-800">
            Current USD/RON rate
            <input
              className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3"
              defaultValue={data.selectedUsdRonRate ?? ""}
              inputMode="decimal"
              list="business-position-rates"
              name="usdRonRate"
              placeholder="Required while USD debt is outstanding"
            />
            <datalist id="business-position-rates">
              {data.rateOptions.map((rate) => (
                <option key={rate.id} value={rate.rate}>
                  Effective {rate.effectiveDate}
                </option>
              ))}
            </datalist>
          </label>
          <button
            className="w-full rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white sm:w-auto"
            type="submit"
          >
            Recalculate
          </button>
        </form>
        {!filterResult.success ? (
          <p
            className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800"
            role="alert"
          >
            {filterResult.error.issues[0]?.message ?? "Check the USD/RON rate."}{" "}
            The latest saved rate is shown instead.
          </p>
        ) : null}
        {missingRate ? (
          <p
            className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
            role="alert"
          >
            Enter a USD/RON rate to estimate supplier liabilities and net
            business value.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="position-components-title">
        <h2 className="sr-only" id="position-components-title">
          Business-position components
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <PositionCard
            label="Warehouse inventory"
            value={position.warehouseInventoryRon}
          />
          <PositionCard
            label="Shop inventory"
            value={position.shopInventoryRon}
          />
          <PositionCard label="Cash" value={position.cashRon} />
          <PositionCard label="Bank" value={position.bankRon} />
          <PositionCard
            label="Customer receivables"
            value={position.customerReceivablesRon}
          />
          <article className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-red-700">
              Supplier payables
              {position.usesExchangeRateEstimate ? " (estimated RON)" : ""}
            </h2>
            <p className="mt-3 text-xl font-bold text-slate-950">
              {formatRON(position.supplierPayablesRon)}
            </p>
            <p className="mt-1 font-semibold text-slate-700">
              {formatUSD(position.supplierPayablesUsd)}
            </p>
            <p className="mt-3 text-sm text-slate-600">
              {position.estimatedSupplierPayablesRon === null
                ? "Combined RON estimate unavailable."
                : `Combined value: ${formatRON(position.estimatedSupplierPayablesRon)}`}
            </p>
          </article>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-bold text-slate-950">Exact calculation</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <caption className="sr-only">
              Business-position calculation components
            </caption>
            <tbody className="divide-y divide-slate-100">
              {[
                ["+ Warehouse inventory", position.warehouseInventoryRon],
                ["+ Shop inventory", position.shopInventoryRon],
                ["+ Cash", position.cashRon],
                ["+ Bank", position.bankRon],
                ["+ Customer receivables", position.customerReceivablesRon],
              ].map(([label, amount]) => (
                <tr key={label}>
                  <th className="px-3 py-3 text-left font-semibold">{label}</th>
                  <td className="px-3 py-3 text-right font-semibold">
                    {formatRON(amount as MoneyAmount)}
                  </td>
                </tr>
              ))}
              <tr className="bg-red-50">
                <th className="px-3 py-3 text-left font-semibold text-red-900">
                  − Supplier payables
                  {position.usesExchangeRateEstimate
                    ? ` (USD ${position.usdRonRate ?? "rate missing"})`
                    : ""}
                </th>
                <td className="px-3 py-3 text-right font-semibold text-red-900">
                  {position.estimatedSupplierPayablesRon === null
                    ? "Unavailable"
                    : formatRON(position.estimatedSupplierPayablesRon)}
                </td>
              </tr>
              <tr className="border-t-2 border-slate-900 bg-slate-950 text-white">
                <th className="px-3 py-4 text-left text-base font-bold">
                  = Net business value
                  {position.usesExchangeRateEstimate ? " (estimated)" : ""}
                </th>
                <td className="px-3 py-4 text-right text-xl font-bold">
                  {position.netBusinessValueRon === null
                    ? "Unavailable"
                    : formatRON(position.netBusinessValueRon)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Revenue is deliberately absent from this formula. Adding it would
          double-count value already represented by the balance components.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-2xl font-bold text-slate-950">
            Save daily snapshot
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            The server recomputes live ledger balances when saving. Snapshots
            are immutable and limited to one per business date.
          </p>
          {context.role === "admin" ? (
            <BusinessPositionSnapshotForm
              key={`${data.asOfDate}:${position.usdRonRate ?? "none"}`}
              rateRequired={position.supplierPayablesUsd !== "0.00"}
              snapshotDate={data.asOfDate}
              usdRonRate={position.usdRonRate}
            />
          ) : (
            <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              Only administrators can save snapshots.
            </p>
          )}
        </section>

        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm sm:p-8">
          <h2 className="text-2xl font-bold text-amber-950">
            Net-worth change is not exact profit
          </h2>
          <p className="mt-3 text-sm leading-6 text-amber-900">
            Owner contributions and withdrawals, inventory adjustments, and
            currency-rate changes can move net business value without being
            operating profit. The trend below is therefore labeled as net-worth
            change only.
          </p>
        </section>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-bold text-slate-950">
          Historical snapshot trend
        </h2>
        {orderedTrend.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
            No snapshots have been saved yet.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3 text-right">Net business value</th>
                  <th className="px-3 py-3 text-right">Net-worth change</th>
                  <th className="px-3 py-3">Valuation</th>
                  <th className="px-3 py-3">Saved by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orderedTrend.map((point) => (
                  <tr key={point.id}>
                    <td className="whitespace-nowrap px-3 py-3 font-semibold">
                      {point.snapshotDate}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-bold">
                      {point.position.netBusinessValueRon === null
                        ? "Unavailable"
                        : formatRON(point.position.netBusinessValueRon)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-semibold">
                      {point.changeFromPreviousRon === null
                        ? "Baseline"
                        : formatRON(point.changeFromPreviousRon)}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {point.position.usesExchangeRateEstimate
                        ? `Estimated at ${point.position.usdRonRate} USD/RON`
                        : "No USD estimate involved"}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {point.createdByName}
                      <span className="mt-1 block text-xs text-slate-400">
                        {formatInstantInBusinessTimeZone(
                          point.createdAt,
                          context.business.timezone,
                        )}
                      </span>
                    </td>
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
