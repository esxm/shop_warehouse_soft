import { randomUUID } from "node:crypto";

import Decimal from "decimal.js";

import { CollapsiblePanel } from "@/components/collapsible-panel";
import { HistoryPeriodFilter } from "@/components/history-period-filter";
import { ProductManagement } from "@/components/product-management";
import { StockMovementForm } from "@/components/stock-movement-form";
import { StockMovementReversalForm } from "@/components/stock-movement-reversal-form";
import { requireBusinessMember } from "@/lib/auth/session";
import { formatInstantInBusinessTimeZone } from "@/lib/date/business-date";
import { resolveHistoryPeriod } from "@/lib/date/history-date";
import { formatRON, parseMoneyInput } from "@/lib/money/money";
import { productSearchSchema } from "@/lib/validation/products";
import { getOpenBusinessDay } from "@/services/business-days";
import {
  getProductStockBalances,
  getStockLocations,
  getStockMovements,
  type StockMovementType,
} from "@/services/product-stock";
import { getProductCategories, searchProducts } from "@/services/products";

const successMessages: Readonly<Record<string, string>> = {
  created: "Stock movement recorded.",
  reversed: "Stock movement reversed.",
};

const movementHistoryFilters = [
  { value: "all", label: "All movements", types: [] },
  {
    value: "entries",
    label: "Entries / incoming",
    types: ["opening", "supplier_receipt", "return"],
  },
  {
    value: "outgoing",
    label: "Sales / outgoing",
    types: ["sale", "damage"],
  },
  { value: "transfers", label: "Transfers", types: ["transfer"] },
  { value: "adjustments", label: "Adjustments", types: ["adjustment"] },
  { value: "opening", label: "Opening stock", types: ["opening"] },
  {
    value: "supplier_receipts",
    label: "Supplier receipts",
    types: ["supplier_receipt"],
  },
  { value: "sales", label: "Sales", types: ["sale"] },
  { value: "returns", label: "Returns", types: ["return"] },
  { value: "damage", label: "Damage / loss", types: ["damage"] },
] as const satisfies readonly {
  value: string;
  label: string;
  types: readonly StockMovementType[];
}[];

function formatQuantity(quantity: string): string {
  try {
    return BigInt(quantity).toLocaleString("en-US");
  } catch {
    return quantity;
  }
}

function formatUnitRON(unitCostRon: string): string {
  try {
    return formatRON(parseMoneyInput(new Decimal(unitCostRon).toFixed(2)));
  } catch {
    return `${unitCostRon} RON`;
  }
}

export default async function StockPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const context = await requireBusinessMember();
  const query = await searchParams;
  const showInventoryAdministration = context.role === "admin";
  const firstQueryValue = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const historyPeriod = resolveHistoryPeriod(query, context.business.timezone);
  const movementFilterValue = firstQueryValue(query.movement_filter) ?? "all";
  const movementFilter =
    movementHistoryFilters.find(
      (filter) => filter.value === movementFilterValue,
    ) ?? movementHistoryFilters[0];

  const productSearchResult = productSearchSchema.safeParse({
    query: firstQueryValue(query.product_q) ?? "",
    categoryId: firstQueryValue(query.product_category) ?? "",
    includeInactive: firstQueryValue(query.product_status) === "all",
  });
  const productFilters = productSearchResult.success
    ? productSearchResult.data
    : { query: "", categoryId: null, includeInactive: false };
  const [
    openDay,
    products,
    managedProducts,
    categories,
    locations,
    balances,
    movements,
  ] = await Promise.all([
    showInventoryAdministration
      ? getOpenBusinessDay(context.business.id)
      : Promise.resolve(null),
    showInventoryAdministration
      ? searchProducts(context, {
          query: "",
          categoryId: null,
          includeInactive: false,
        })
      : Promise.resolve([]),
    showInventoryAdministration
      ? searchProducts(context, productFilters)
      : Promise.resolve([]),
    showInventoryAdministration
      ? getProductCategories(context, true)
      : Promise.resolve([]),
    getStockLocations(context),
    getProductStockBalances(context),
    showInventoryAdministration
      ? getStockMovements(context, {
          ...historyPeriod,
          movementTypes: movementFilter.types,
        })
      : Promise.resolve([]),
  ]);
  const resultKey = Object.keys(successMessages).find(
    (key) => query[key] === "1",
  );
  const searchText = (firstQueryValue(query.q) ?? "").trim();
  const locationFilter = firstQueryValue(query.location) ?? "";
  const importedCount =
    typeof query.imported === "string" && /^\d+$/.test(query.imported)
      ? Number(query.imported)
      : null;
  const activeLocations = locations.filter((location) => location.isActive);
  const productRows = Array.from(
    balances
      .reduce(
        (grouped, balance) => {
          const existing = grouped.get(balance.productId);
          if (existing) {
            existing.balances.set(balance.locationId, balance.quantity);
          } else {
            grouped.set(balance.productId, {
              productId: balance.productId,
              productCode: balance.productCode,
              productName: balance.productName,
              categoryName: balance.categoryName,
              productIsActive: balance.productIsActive,
              balances: new Map([[balance.locationId, balance.quantity]]),
            });
          }
          return grouped;
        },
        new Map<
          string,
          {
            productId: string;
            productCode: string;
            productName: string;
            categoryName: string;
            productIsActive: boolean;
            balances: Map<string, string>;
          }
        >(),
      )
      .values(),
  );
  const normalizedSearch = searchText.toLocaleLowerCase();
  const filteredProductRows = productRows.filter(
    (product) =>
      normalizedSearch === "" ||
      product.productCode.toLocaleLowerCase().includes(normalizedSearch) ||
      product.productName.toLocaleLowerCase().includes(normalizedSearch) ||
      product.categoryName.toLocaleLowerCase().includes(normalizedSearch),
  );
  const displayedLocations = locationFilter
    ? locations.filter((location) => location.id === locationFilter)
    : locations;

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

      <CollapsiblePanel
        description="Search quantities across the shop and warehouse."
        title="Stock by location"
      >
        <form
          className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_16rem_auto]"
          method="get"
        >
          <label className="text-sm font-semibold text-slate-800">
            Search product
            <input
              className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3"
              defaultValue={searchText}
              name="q"
              placeholder="Code, product, or category"
              type="search"
            />
          </label>
          <label className="text-sm font-semibold text-slate-800">
            Location
            <select
              className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              defaultValue={locationFilter}
              name="location"
            >
              <option value="">All locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="w-full self-end rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white sm:w-auto"
            type="submit"
          >
            Search
          </button>
        </form>
        {filteredProductRows.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
            {productRows.length === 0
              ? "Add a product to start quantity tracking."
              : "No products match this search."}
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-3 py-3">Code</th>
                  <th className="px-3 py-3">Product</th>
                  <th className="px-3 py-3">Category</th>
                  {displayedLocations.map((location) => (
                    <th className="px-3 py-3 text-right" key={location.id}>
                      {location.name}
                      {location.isActive ? "" : " (inactive)"}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredProductRows.map((product) => {
                  const total = displayedLocations.reduce(
                    (sum, location) =>
                      sum + BigInt(product.balances.get(location.id) ?? "0"),
                    BigInt(0),
                  );
                  return (
                    <tr
                      className="border-b border-slate-100 last:border-0"
                      key={product.productId}
                    >
                      <td className="px-3 py-4 font-mono font-semibold text-teal-800">
                        {product.productCode}
                      </td>
                      <td className="px-3 py-4">
                        <span className="font-semibold text-slate-950">
                          {product.productName}
                        </span>
                        {!product.productIsActive ? (
                          <span className="ml-2 rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-700">
                            inactive
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-4 text-slate-600">
                        {product.categoryName}
                      </td>
                      {displayedLocations.map((location) => {
                        const quantity =
                          product.balances.get(location.id) ?? "0";
                        return (
                          <td
                            className={
                              BigInt(quantity) < BigInt(0)
                                ? "px-3 py-4 text-right font-bold text-red-700"
                                : "px-3 py-4 text-right font-semibold text-slate-800"
                            }
                            key={location.id}
                          >
                            {formatQuantity(quantity)}
                          </td>
                        );
                      })}
                      <td
                        className={
                          total < BigInt(0)
                            ? "px-3 py-4 text-right font-bold text-red-700"
                            : "px-3 py-4 text-right font-bold text-teal-900"
                        }
                      >
                        {total.toLocaleString("en-US")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CollapsiblePanel>

      {showInventoryAdministration ? (
        <>
          <CollapsiblePanel
            description="Search, add, edit, import, and organize products."
            id="products"
            title="Products"
          >
            <ProductManagement
              categories={categories}
              filters={productFilters}
              importedCount={importedCount}
              products={managedProducts}
              role={context.role}
              searchError={
                productSearchResult.success
                  ? null
                  : (productSearchResult.error.issues[0]?.message ??
                    "Check the product filters.")
              }
            />
          </CollapsiblePanel>

          <CollapsiblePanel
            description="Opening stock, transfers, returns, damage, and corrections."
            id="record-movement"
            title="Record a movement"
          >
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Supplier receipts and sales will post automatically from their
              linked workflows. Use this form for opening stock, transfers,
              returns, damage, and count corrections.
            </p>
            <div className="mt-5">
              {openDay ? (
                <StockMovementForm
                  businessDate={openDay.businessDate}
                  businessDayId={openDay.id}
                  locations={activeLocations}
                  products={products}
                  referenceId={randomUUID()}
                  requestId={randomUUID()}
                  role={context.role}
                />
              ) : (
                <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                  The automatic current business day is unavailable. Refresh
                  before recording stock.
                </p>
              )}
            </div>
          </CollapsiblePanel>

          <CollapsiblePanel
            description={`Movements from ${historyPeriod.fromDate} to ${historyPeriod.toDate}.`}
            id="movement-history"
            title="Movement history"
          >
            <HistoryPeriodFilter
              action="/stock"
              anchor="movement-history"
              error={historyPeriod.error}
              fromDate={historyPeriod.fromDate}
              toDate={historyPeriod.toDate}
            >
              <label className="text-sm font-semibold text-slate-800">
                Movement type
                <select
                  className="mt-2 block rounded-xl border border-slate-300 bg-white px-4 py-2.5"
                  defaultValue={movementFilter.value}
                  name="movement_filter"
                >
                  {movementHistoryFilters.map((filter) => (
                    <option key={filter.value} value={filter.value}>
                      {filter.label}
                    </option>
                  ))}
                </select>
              </label>
            </HistoryPeriodFilter>
            {movements.length === 0 ? (
              <p className="mt-4 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
                No {movementFilter.label.toLocaleLowerCase()} were recorded from{" "}
                {historyPeriod.fromDate} to {historyPeriod.toDate}.
              </p>
            ) : (
              <ul className="mt-5 max-h-[38rem] space-y-4 overflow-y-auto overscroll-contain pr-2">
                {movements.map((movement) => (
                  <li
                    className="rounded-2xl border border-slate-200 p-5"
                    key={movement.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="font-bold text-slate-950">
                          {movement.productCode} · {movement.productName}
                        </p>
                        <p className="mt-1 text-sm capitalize text-slate-700">
                          {movement.movementType.replaceAll("_", " ")}
                          {" · "}
                          {movement.sourceLocationName
                            ? `from ${movement.sourceLocationName}`
                            : `to ${movement.destinationLocationName ?? "inventory"}`}
                          {movement.destinationLocationName &&
                          movement.sourceLocationName
                            ? ` to ${movement.destinationLocationName}`
                            : ""}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                          {movement.businessDate ?? "No business day"} ·{" "}
                          {formatInstantInBusinessTimeZone(
                            movement.createdAt,
                            context.business.timezone,
                          )}{" "}
                          ·{" "}
                          {movement.createdByName ??
                            (movement.createdBy === context.user.id
                              ? `${context.user.displayName} (${context.role})`
                              : "Team member")}
                        </p>
                        {movement.notes ? (
                          <p className="mt-2 text-sm text-slate-600">
                            {movement.notes}
                          </p>
                        ) : null}
                        {movement.negativeStockOverride ? (
                          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                            Administrator negative-stock override:{" "}
                            {movement.overrideReason}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-teal-900">
                          {formatQuantity(movement.quantity)} pcs
                        </p>
                        {movement.unitCostRon ? (
                          <>
                            <p className="mt-1 text-sm text-slate-500">
                              {formatUnitRON(movement.unitCostRon)} each
                            </p>
                            {movement.costCurrency === "USD" &&
                            movement.originalUnitCost &&
                            movement.exchangeRate ? (
                              <p className="mt-1 text-xs text-slate-500">
                                USD {movement.originalUnitCost} at{" "}
                                {movement.exchangeRate} RON/USD
                              </p>
                            ) : null}
                            {movement.costSource ===
                            "source_weighted_average" ? (
                              <p className="mt-1 text-xs font-semibold text-teal-700">
                                Source weighted average
                              </p>
                            ) : null}
                          </>
                        ) : null}
                        <span
                          className={
                            movement.status === "active"
                              ? "mt-2 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800"
                              : movement.status === "reversed"
                                ? "mt-2 inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                                : "mt-2 inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800"
                          }
                        >
                          {movement.status}
                        </span>
                      </div>
                    </div>
                    {context.role === "admin" &&
                    movement.status === "active" ? (
                      <StockMovementReversalForm
                        movementId={movement.id}
                        requestId={randomUUID()}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CollapsiblePanel>
        </>
      ) : null}
    </div>
  );
}
