import { describe, expect, it } from "vitest";

import { parseBusinessDate } from "@/lib/date/business-date";
import {
  buildInventoryAnalysisReport,
  createInventoryAnalysisCsv,
  type CurrentInventorySourceRow,
  type ProductMovementAnalysisRow,
  type ProductSalesDailySourceRow,
} from "@/lib/reports/inventory-analysis";
import { stockThresholdInputSchema } from "@/lib/validation/inventory-analysis";

const current: CurrentInventorySourceRow[] = [
  {
    productId: "a",
    productCode: "FAST-A",
    productName: "Fast product",
    categoryName: "Products",
    productIsActive: true,
    locationId: "shop",
    locationName: "Shop",
    locationType: "shop",
    quantity: "6",
    minimumQuantity: "7",
    isLowStock: true,
    averageUnitCostRon: "4.00000000",
    inventoryValueRon: "24.00",
    costIsComplete: true,
  },
  {
    productId: "b",
    productCode: "SLOW-B",
    productName: "Slow product",
    categoryName: "Products",
    productIsActive: true,
    locationId: "shop",
    locationName: "Shop",
    locationType: "shop",
    quantity: "5",
    minimumQuantity: "4",
    isLowStock: false,
    averageUnitCostRon: "10.00000000",
    inventoryValueRon: "50.00",
    costIsComplete: true,
  },
];

const sales: ProductSalesDailySourceRow[] = [
  {
    activityDate: "2026-07-02",
    productId: "a",
    productCode: "FAST-A",
    productName: "Fast product",
    categoryName: "Products",
    saleCount: 1,
    returnCount: 1,
    soldQuantity: "4",
    returnedQuantity: "1",
    netQuantity: "3",
    grossSalesRon: "24.00",
    refundsRon: "6.00",
    netRevenueRon: "18.00",
    historicalCostRon: "16.00",
    grossMarginRon: "2.00",
  },
  {
    activityDate: "2026-07-03",
    productId: "a",
    productCode: "FAST-A",
    productName: "Fast product",
    categoryName: "Products",
    saleCount: 1,
    returnCount: 0,
    soldQuantity: "2",
    returnedQuantity: "0",
    netQuantity: "2",
    grossSalesRon: "12.00",
    refundsRon: "0.00",
    netRevenueRon: "12.00",
    historicalCostRon: "8.00",
    grossMarginRon: "4.00",
  },
];

const movements: ProductMovementAnalysisRow[] = [
  {
    id: "m1",
    businessDate: "2026-07-03",
    productCode: "FAST-A",
    productName: "Fast product",
    movementType: "sale",
    sourceLocationName: "Shop",
    destinationLocationName: null,
    quantity: "2",
    unitCostRon: "4.00000000",
    status: "active",
    referenceType: "product_sale",
    createdByName: "Employee",
    createdAt: "2026-07-03T10:00:00Z",
  },
];

describe("inventory analysis aggregation", () => {
  const report = buildInventoryAnalysisReport(current, sales, movements);

  it("aggregates exact sales, returns, historical cost, and margin", () => {
    expect(report.productSales[0]).toMatchObject({
      soldQuantity: "6",
      returnedQuantity: "1",
      netQuantity: "5",
      grossSalesRon: "36.00",
      refundsRon: "6.00",
      netRevenueRon: "30.00",
      historicalCostRon: "24.00",
      grossMarginRon: "6.00",
      grossMarginPercent: "20.0000",
      profitPercentOnCost: "25.0000",
    });
  });

  it("calculates current historical value and low-stock count", () => {
    expect(report.totalInventoryValueRon).toBe("74.00");
    expect(report.lowStockCount).toBe(1);
    expect(report.uncostedLocationCount).toBe(0);
  });

  it("ranks fast and slow products by net sold pieces", () => {
    expect(report.fastMoving.map((row) => row.productCode)).toEqual(["FAST-A"]);
    expect(report.slowMoving.map((row) => row.productCode)).toEqual([
      "SLOW-B",
      "FAST-A",
    ]);
  });

  it("calculates selected-range totals without averaging percentages", () => {
    expect(report.totalNetRevenueRon).toBe("30.00");
    expect(report.totalHistoricalCostRon).toBe("24.00");
    expect(report.totalGrossMarginRon).toBe("6.00");
    expect(report.totalGrossMarginPercent).toBe("20.0000");
    expect(report.totalProfitPercentOnCost).toBe("25.0000");
  });

  it("exports current stock, product sales, and movement history", () => {
    const csv = createInventoryAnalysisCsv(report, {
      fromDate: parseBusinessDate("2026-07-01"),
      toDate: parseBusinessDate("2026-07-31"),
      preset: "custom",
    });

    expect(csv).toContain('"Current inventory by product and location"');
    expect(csv).toContain('"Sales by product"');
    expect(csv).toContain('"Product movement history"');
    expect(csv).toContain('"FAST-A"');
    expect(csv).toContain('"6.00"');
    expect(csv).toContain('"Profit percent on historical cost"');
  });

  it("accepts zero to disable and rejects fractional thresholds", () => {
    const base = {
      productId: "40000000-0000-4000-8000-000000000001",
      inventoryLocationId: "41000000-0000-4000-8000-000000000001",
    };

    expect(
      stockThresholdInputSchema.safeParse({
        ...base,
        minimumQuantity: "0",
      }).success,
    ).toBe(true);
    expect(
      stockThresholdInputSchema.safeParse({
        ...base,
        minimumQuantity: "1.5",
      }).success,
    ).toBe(false);
  });
});
