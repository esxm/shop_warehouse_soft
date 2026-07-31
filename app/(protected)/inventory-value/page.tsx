import Decimal from "decimal.js";

import { CollapsiblePanel } from "@/components/collapsible-panel";
import {
  redirectEmployeeToDailySales,
  requireBusinessMember,
} from "@/lib/auth/session";
import { formatRON, formatUSD, parseMoneyInput } from "@/lib/money/money";
import { getProductInventoryValuation } from "@/services/inventory-value";

function formatUnitRON(unitCostRon: string): string {
  try {
    return formatRON(parseMoneyInput(new Decimal(unitCostRon).toFixed(2)));
  } catch {
    return `${unitCostRon} RON`;
  }
}

function formatUnitUSD(unitCostUsd: string): string {
  try {
    return formatUSD(parseMoneyInput(new Decimal(unitCostUsd).toFixed(2)));
  } catch {
    return `${unitCostUsd} USD`;
  }
}

export default async function ProductInventoryPage() {
  const context = await requireBusinessMember();
  redirectEmployeeToDailySales(context);
  const valuation = await getProductInventoryValuation(context);

  return (
    <div className="space-y-6">
      <CollapsiblePanel
        description="Current quantities, weighted costs, and inventory value."
        title="Product-valued inventory"
      >
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl bg-teal-50 p-5">
            <p className="text-xs font-semibold uppercase text-teal-700">
              Inventory total (USD)
            </p>
            <p className="mt-2 text-2xl font-bold text-teal-950">
              {valuation.totalUsd
                ? formatUnitUSD(valuation.totalUsd)
                : "Stored USD cost required"}
            </p>
          </article>
          <article className="rounded-2xl bg-slate-50 p-5">
            <p className="text-xs font-semibold uppercase text-slate-500">
              Historical inventory total (RON)
            </p>
            <p className="mt-2 text-2xl font-bold">
              {formatUnitRON(valuation.totalRon)}
            </p>
          </article>
        </div>

        {valuation.uncostedProductCount > 0 ? (
          <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            {valuation.uncostedProductCount} product-location balances contain
            legacy stock without cost and are excluded from the valued total.
          </p>
        ) : null}

        {valuation.rows.length === 0 ? (
          <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
            No product quantities are currently in inventory.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2 text-right">Quantity</th>
                  <th className="px-3 py-2 text-right">USD price / piece</th>
                  <th className="px-3 py-2 text-right">Inventory value</th>
                </tr>
              </thead>
              <tbody>
                {valuation.rows.map((row) => (
                  <tr
                    className="border-b border-slate-100"
                    key={`${row.productId}-${row.locationId}`}
                  >
                    <td className="px-3 py-3">
                      <span className="font-mono text-xs text-teal-800">
                        {row.internalCode}
                      </span>
                      <span className="ml-2 font-semibold">
                        {row.productName}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {row.locationName} ({row.locationType})
                    </td>
                    <td className="px-3 py-3 text-right font-semibold">
                      {row.quantity}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {row.averageUnitCostUsd ? (
                        <>
                          <span className="font-semibold text-teal-900">
                            {formatUnitUSD(row.averageUnitCostUsd)}
                          </span>
                          <span className="mt-1 block text-xs text-slate-500">
                            Stored USD product price
                          </span>
                          {row.averageUnitCostRon ? (
                            <span className="mt-1 block text-xs text-slate-500">
                              Weighted RON:{" "}
                              {formatUnitRON(row.averageUnitCostRon)}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        "Cost required"
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold">
                      {row.costIsComplete && row.inventoryValueUsd ? (
                        <>
                          <span className="text-teal-900">
                            {formatUnitUSD(row.inventoryValueUsd)}
                          </span>
                          <span className="mt-1 block text-xs font-normal text-slate-500">
                            {formatUnitRON(row.inventoryValueRon)}
                          </span>
                        </>
                      ) : (
                        "Not valued"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-xs leading-5 text-slate-500">
          Products priced in USD use their stored USD product price. RON-only
          products use the purchase exchange rate entered when stock was
          received. Historical RON weighted cost remains visible at two
          decimals.
        </p>
      </CollapsiblePanel>
    </div>
  );
}
