import Decimal from "decimal.js";

import type { RevenueDateRange } from "@/lib/reports/revenue";
import { csvRow } from "@/lib/reports/csv";

export type CurrentInventorySourceRow = Readonly<{
  productId: string;
  productCode: string;
  productName: string;
  categoryName: string;
  productIsActive: boolean;
  locationId: string;
  locationName: string;
  locationType: "warehouse" | "shop";
  quantity: string;
  minimumQuantity: string;
  isLowStock: boolean;
  averageUnitCostRon: string | null;
  inventoryValueRon: string;
  costIsComplete: boolean;
}>;

export type ProductSalesDailySourceRow = Readonly<{
  activityDate: string;
  productId: string;
  productCode: string;
  productName: string;
  categoryName: string;
  saleCount: number;
  returnCount: number;
  soldQuantity: string;
  returnedQuantity: string;
  netQuantity: string;
  grossSalesRon: string;
  refundsRon: string;
  netRevenueRon: string;
  historicalCostRon: string;
  grossMarginRon: string;
}>;

export type ProductMovementAnalysisRow = Readonly<{
  id: string;
  businessDate: string;
  productCode: string;
  productName: string;
  movementType: string;
  sourceLocationName: string | null;
  destinationLocationName: string | null;
  quantity: string;
  unitCostRon: string | null;
  status: "active" | "reversed" | "reversal";
  referenceType: string;
  createdByName: string | null;
  createdAt: string;
}>;

export type ProductSalesAnalysisRow = Readonly<{
  productId: string;
  productCode: string;
  productName: string;
  categoryName: string;
  saleCount: number;
  returnCount: number;
  soldQuantity: string;
  returnedQuantity: string;
  netQuantity: string;
  grossSalesRon: string;
  refundsRon: string;
  netRevenueRon: string;
  historicalCostRon: string;
  grossMarginRon: string;
  grossMarginPercent: string;
  profitPercentOnCost: string;
}>;

export type ProductVelocityRow = Readonly<{
  productId: string;
  productCode: string;
  productName: string;
  currentQuantity: string;
  netSoldQuantity: string;
}>;

export type InventoryAnalysisReport = Readonly<{
  currentInventory: readonly CurrentInventorySourceRow[];
  productSales: readonly ProductSalesAnalysisRow[];
  movements: readonly ProductMovementAnalysisRow[];
  fastMoving: readonly ProductVelocityRow[];
  slowMoving: readonly ProductVelocityRow[];
  totalInventoryValueRon: string;
  lowStockCount: number;
  uncostedLocationCount: number;
  totalNetRevenueRon: string;
  totalHistoricalCostRon: string;
  totalGrossMarginRon: string;
  totalGrossMarginPercent: string;
  totalProfitPercentOnCost: string;
}>;

type SalesAccumulator = {
  productId: string;
  productCode: string;
  productName: string;
  categoryName: string;
  saleCount: number;
  returnCount: number;
  soldQuantity: bigint;
  returnedQuantity: bigint;
  netQuantity: bigint;
  grossSalesRon: Decimal;
  refundsRon: Decimal;
  netRevenueRon: Decimal;
  historicalCostRon: Decimal;
  grossMarginRon: Decimal;
};

function marginPercent(margin: Decimal, revenue: Decimal): string {
  return revenue.isZero()
    ? "0.0000"
    : margin.dividedBy(revenue.abs()).times(100).toFixed(4);
}

function profitPercentOnCost(profit: Decimal, cost: Decimal): string {
  return cost.isZero()
    ? "0.0000"
    : profit.dividedBy(cost.abs()).times(100).toFixed(4);
}

function compareBigInt(left: bigint, right: bigint): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function buildInventoryAnalysisReport(
  currentInventory: readonly CurrentInventorySourceRow[],
  salesDaily: readonly ProductSalesDailySourceRow[],
  movements: readonly ProductMovementAnalysisRow[],
): InventoryAnalysisReport {
  const salesByProduct = new Map<string, SalesAccumulator>();

  for (const row of salesDaily) {
    const current = salesByProduct.get(row.productId) ?? {
      productId: row.productId,
      productCode: row.productCode,
      productName: row.productName,
      categoryName: row.categoryName,
      saleCount: 0,
      returnCount: 0,
      soldQuantity: BigInt(0),
      returnedQuantity: BigInt(0),
      netQuantity: BigInt(0),
      grossSalesRon: new Decimal(0),
      refundsRon: new Decimal(0),
      netRevenueRon: new Decimal(0),
      historicalCostRon: new Decimal(0),
      grossMarginRon: new Decimal(0),
    };
    current.saleCount += row.saleCount;
    current.returnCount += row.returnCount;
    current.soldQuantity += BigInt(row.soldQuantity);
    current.returnedQuantity += BigInt(row.returnedQuantity);
    current.netQuantity += BigInt(row.netQuantity);
    current.grossSalesRon = current.grossSalesRon.plus(row.grossSalesRon);
    current.refundsRon = current.refundsRon.plus(row.refundsRon);
    current.netRevenueRon = current.netRevenueRon.plus(row.netRevenueRon);
    current.historicalCostRon = current.historicalCostRon.plus(
      row.historicalCostRon,
    );
    current.grossMarginRon = current.grossMarginRon.plus(row.grossMarginRon);
    salesByProduct.set(row.productId, current);
  }

  const productSales = [...salesByProduct.values()]
    .map((row): ProductSalesAnalysisRow => ({
      productId: row.productId,
      productCode: row.productCode,
      productName: row.productName,
      categoryName: row.categoryName,
      saleCount: row.saleCount,
      returnCount: row.returnCount,
      soldQuantity: row.soldQuantity.toString(),
      returnedQuantity: row.returnedQuantity.toString(),
      netQuantity: row.netQuantity.toString(),
      grossSalesRon: row.grossSalesRon.toFixed(2),
      refundsRon: row.refundsRon.toFixed(2),
      netRevenueRon: row.netRevenueRon.toFixed(2),
      historicalCostRon: row.historicalCostRon.toFixed(2),
      grossMarginRon: row.grossMarginRon.toFixed(2),
      grossMarginPercent: marginPercent(row.grossMarginRon, row.netRevenueRon),
      profitPercentOnCost: profitPercentOnCost(
        row.grossMarginRon,
        row.historicalCostRon,
      ),
    }))
    .sort(
      (left, right) =>
        new Decimal(right.netRevenueRon).comparedTo(left.netRevenueRon) ||
        left.productName.localeCompare(right.productName),
    );

  const velocityByProduct = new Map<string, ProductVelocityRow>();
  for (const row of currentInventory) {
    if (!row.productIsActive) {
      continue;
    }
    const existing = velocityByProduct.get(row.productId);
    velocityByProduct.set(row.productId, {
      productId: row.productId,
      productCode: row.productCode,
      productName: row.productName,
      currentQuantity: (
        BigInt(existing?.currentQuantity ?? "0") + BigInt(row.quantity)
      ).toString(),
      netSoldQuantity: existing?.netSoldQuantity ?? "0",
    });
  }
  for (const row of productSales) {
    const existing = velocityByProduct.get(row.productId);
    velocityByProduct.set(row.productId, {
      productId: row.productId,
      productCode: row.productCode,
      productName: row.productName,
      currentQuantity: existing?.currentQuantity ?? "0",
      netSoldQuantity: row.netQuantity,
    });
  }

  const velocity = [...velocityByProduct.values()];
  const fastMoving = velocity
    .filter((row) => BigInt(row.netSoldQuantity) > BigInt(0))
    .sort(
      (left, right) =>
        compareBigInt(
          BigInt(right.netSoldQuantity),
          BigInt(left.netSoldQuantity),
        ) || left.productName.localeCompare(right.productName),
    )
    .slice(0, 10);
  const slowMoving = velocity
    .filter((row) => BigInt(row.currentQuantity) > BigInt(0))
    .sort(
      (left, right) =>
        compareBigInt(
          BigInt(left.netSoldQuantity),
          BigInt(right.netSoldQuantity),
        ) || left.productName.localeCompare(right.productName),
    )
    .slice(0, 10);

  const totalInventoryValue = currentInventory.reduce(
    (total, row) =>
      row.costIsComplete ? total.plus(row.inventoryValueRon) : total,
    new Decimal(0),
  );
  const totalNetRevenue = productSales.reduce(
    (total, row) => total.plus(row.netRevenueRon),
    new Decimal(0),
  );
  const totalHistoricalCost = productSales.reduce(
    (total, row) => total.plus(row.historicalCostRon),
    new Decimal(0),
  );
  const totalGrossMargin = productSales.reduce(
    (total, row) => total.plus(row.grossMarginRon),
    new Decimal(0),
  );

  return {
    currentInventory,
    productSales,
    movements,
    fastMoving,
    slowMoving,
    totalInventoryValueRon: totalInventoryValue.toFixed(2),
    lowStockCount: currentInventory.filter((row) => row.isLowStock).length,
    uncostedLocationCount: currentInventory.filter(
      (row) => BigInt(row.quantity) !== BigInt(0) && !row.costIsComplete,
    ).length,
    totalNetRevenueRon: totalNetRevenue.toFixed(2),
    totalHistoricalCostRon: totalHistoricalCost.toFixed(2),
    totalGrossMarginRon: totalGrossMargin.toFixed(2),
    totalGrossMarginPercent: marginPercent(totalGrossMargin, totalNetRevenue),
    totalProfitPercentOnCost: profitPercentOnCost(
      totalGrossMargin,
      totalHistoricalCost,
    ),
  };
}

export function createInventoryAnalysisCsv(
  report: InventoryAnalysisReport,
  range: RevenueDateRange,
): string {
  const lines = [
    csvRow(["Inventory analysis", `${range.fromDate} to ${range.toDate}`]),
    "",
    csvRow(["Current inventory by product and location"]),
    csvRow([
      "Product code",
      "Product",
      "Category",
      "Location",
      "Location type",
      "Quantity",
      "Low-stock threshold",
      "Low stock",
      "Weighted unit cost RON",
      "Inventory value RON",
      "Cost complete",
    ]),
    ...report.currentInventory.map((row) =>
      csvRow([
        row.productCode,
        row.productName,
        row.categoryName,
        row.locationName,
        row.locationType,
        row.quantity,
        row.minimumQuantity,
        row.isLowStock ? "yes" : "no",
        row.averageUnitCostRon ?? "",
        row.inventoryValueRon,
        row.costIsComplete ? "yes" : "no",
      ]),
    ),
    "",
    csvRow(["Sales by product"]),
    csvRow([
      "Product code",
      "Product",
      "Sold pieces",
      "Returned pieces",
      "Net pieces",
      "Gross sales RON",
      "Refunds RON",
      "Net revenue RON",
      "Historical cost RON",
      "Gross margin RON",
      "Gross margin percent of revenue",
      "Profit percent on historical cost",
    ]),
    ...report.productSales.map((row) =>
      csvRow([
        row.productCode,
        row.productName,
        row.soldQuantity,
        row.returnedQuantity,
        row.netQuantity,
        row.grossSalesRon,
        row.refundsRon,
        row.netRevenueRon,
        row.historicalCostRon,
        row.grossMarginRon,
        row.grossMarginPercent,
        row.profitPercentOnCost,
      ]),
    ),
    "",
    csvRow(["Product movement history"]),
    csvRow([
      "Date",
      "Product code",
      "Product",
      "Movement",
      "Source",
      "Destination",
      "Quantity",
      "Unit cost RON",
      "Status",
      "Reference type",
      "Recorded by",
      "Recorded at",
    ]),
    ...report.movements.map((row) =>
      csvRow([
        row.businessDate,
        row.productCode,
        row.productName,
        row.movementType,
        row.sourceLocationName ?? "",
        row.destinationLocationName ?? "",
        row.quantity,
        row.unitCostRon ?? "",
        row.status,
        row.referenceType,
        row.createdByName ?? "",
        row.createdAt,
      ]),
    ),
  ];

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
