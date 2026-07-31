import { describe, expect, it } from "vitest";

import {
  calculateSupplierUsdAllocationEconomics,
  buildSupplierPayablesReport,
  createSupplierPayablesCsv,
  supplierPayablesFilterSchema,
  type SupplierPayablePurchaseSource,
  type SupplierPayablesFilter,
} from "@/lib/reports/supplier-payables";
import { parseBusinessDate } from "@/lib/date/business-date";

const supplierIds = {
  atlas: "21000000-0000-4000-8000-000000000001",
  local: "21000000-0000-4000-8000-000000000002",
};

const purchases: readonly SupplierPayablePurchaseSource[] = [
  {
    purchaseId: "21000000-0000-4000-8000-000000000011",
    supplierId: supplierIds.atlas,
    supplierName: "Atlas Imports",
    purchaseDate: "2026-04-01",
    dueDate: "2026-05-01",
    currency: "USD",
    originalAmount: "100.00",
    allocatedOriginalAmount: "40.00",
    remainingOriginalAmount: "60.00",
    status: "partial",
  },
  {
    purchaseId: "21000000-0000-4000-8000-000000000012",
    supplierId: supplierIds.atlas,
    supplierName: "Atlas Imports",
    purchaseDate: "2026-05-01",
    dueDate: "2026-06-01",
    currency: "USD",
    originalAmount: "50.00",
    allocatedOriginalAmount: "10.00",
    remainingOriginalAmount: "40.00",
    status: "partial",
  },
  {
    purchaseId: "21000000-0000-4000-8000-000000000013",
    supplierId: supplierIds.atlas,
    supplierName: "Atlas Imports",
    purchaseDate: "2026-05-15",
    dueDate: "2026-06-15",
    currency: "USD",
    originalAmount: "25.00",
    allocatedOriginalAmount: "0.00",
    remainingOriginalAmount: "0.00",
    status: "reversed",
  },
  {
    purchaseId: "21000000-0000-4000-8000-000000000021",
    supplierId: supplierIds.local,
    supplierName: "Local Goods",
    purchaseDate: "2026-06-01",
    dueDate: null,
    currency: "RON",
    originalAmount: "1000.00",
    allocatedOriginalAmount: "250.00",
    remainingOriginalAmount: "750.00",
    status: "partial",
  },
];

const baseFilter: SupplierPayablesFilter = {
  supplierId: null,
  currency: "all",
  outstandingOnly: false,
  dueFromDate: null,
  dueToDate: null,
};

describe("supplier payables report", () => {
  it("preserves mixed historical rates while applying one payment rate", () => {
    const firstAllocation = calculateSupplierUsdAllocationEconomics(
      "40.00",
      "4.50000000",
      "4.90000000",
    );
    const secondAllocation = calculateSupplierUsdAllocationEconomics(
      "10.00",
      "4.80000000",
      "4.90000000",
    );

    expect(firstAllocation).toEqual({
      historicalRonValue: "180.00",
      actualRonValue: "196.00",
      currencyGainLossRon: "-16.00",
    });
    expect(secondAllocation).toEqual({
      historicalRonValue: "48.00",
      actualRonValue: "49.00",
      currencyGainLossRon: "-1.00",
    });
  });

  it("records paying above historical cost as a loss", () => {
    expect(
      calculateSupplierUsdAllocationEconomics("1000", "4.61", "4.70"),
    ).toEqual({
      historicalRonValue: "4610.00",
      actualRonValue: "4700.00",
      currencyGainLossRon: "-90.00",
    });
  });

  it("keeps original currencies separate and uses only the current rate for estimates", () => {
    const report = buildSupplierPayablesReport(
      purchases,
      baseFilter,
      "4.70000000",
    );

    expect(report.rows).toEqual([
      {
        supplierId: supplierIds.atlas,
        supplierName: "Atlas Imports",
        currency: "USD",
        originalPurchaseTotal: "150.00",
        totalPaid: "50.00",
        remainingOriginalAmount: "100.00",
        estimatedRemainingRon: "470.00",
        oldestUnpaidDate: "2026-04-01",
      },
      {
        supplierId: supplierIds.local,
        supplierName: "Local Goods",
        currency: "RON",
        originalPurchaseTotal: "1000.00",
        totalPaid: "250.00",
        remainingOriginalAmount: "750.00",
        estimatedRemainingRon: "750.00",
        oldestUnpaidDate: "2026-06-01",
      },
    ]);
    expect(report.summary).toEqual({
      totalRonPayables: "750.00",
      totalUsdPayables: "100.00",
      estimatedTotalRon: "1220.00",
    });
  });

  it("withholds current RON estimates when USD remains without a rate", () => {
    const report = buildSupplierPayablesReport(purchases, baseFilter, null);

    expect(report.rows[0].estimatedRemainingRon).toBeNull();
    expect(report.summary.estimatedTotalRon).toBeNull();
  });

  it("excludes reversed purchases and validates purchase balance components", () => {
    expect(
      buildSupplierPayablesReport(purchases, baseFilter, "4.7").rows[0]
        .originalPurchaseTotal,
    ).toBe("150.00");
    expect(() =>
      buildSupplierPayablesReport(
        [{ ...purchases[0], remainingOriginalAmount: "61.00" }],
        baseFilter,
        "4.7",
      ),
    ).toThrow("balance is inconsistent");
  });

  it("filters by supplier, currency, and inclusive due-date range", () => {
    const report = buildSupplierPayablesReport(
      purchases,
      {
        supplierId: supplierIds.atlas,
        currency: "USD",
        outstandingOnly: true,
        dueFromDate: parseBusinessDate("2026-06-01"),
        dueToDate: parseBusinessDate("2026-06-30"),
      },
      "4.7",
    );

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({
      originalPurchaseTotal: "50.00",
      totalPaid: "10.00",
      remainingOriginalAmount: "40.00",
      estimatedRemainingRon: "188.00",
    });
  });

  it("exports the displayed values and explicit current-rate label", () => {
    const report = buildSupplierPayablesReport(purchases, baseFilter, "4.7");
    const csv = createSupplierPayablesCsv(report, baseFilter, {
      rate: "4.7",
      effectiveDate: "2026-07-02",
    });

    expect(csv).toContain(
      '"Current USD/RON estimate rate","4.7 RON per USD, effective 2026-07-02"',
    );
    expect(csv).toContain('"Selected scope","750.00","100.00","1220.00"');
    expect(csv).toContain(
      `"${supplierIds.atlas}","Atlas Imports","USD","150.00","50.00","100.00","470.00","2026-04-01"`,
    );
  });
});

describe("supplier payable filters", () => {
  it("normalizes defaults and valid values", () => {
    expect(supplierPayablesFilterSchema.parse({})).toEqual(baseFilter);
    expect(
      supplierPayablesFilterSchema.parse({
        supplierId: supplierIds.atlas,
        currency: "USD",
        outstandingOnly: "0",
        dueFromDate: "2026-01-01",
        dueToDate: "2026-06-30",
      }),
    ).toEqual({
      supplierId: supplierIds.atlas,
      currency: "USD",
      outstandingOnly: false,
      dueFromDate: "2026-01-01",
      dueToDate: "2026-06-30",
    });
  });

  it("rejects invalid currencies, suppliers, dates, and reversed ranges", () => {
    expect(
      supplierPayablesFilterSchema.safeParse({ currency: "EUR" }).success,
    ).toBe(false);
    expect(
      supplierPayablesFilterSchema.safeParse({
        supplierId: "bad-id",
      }).success,
    ).toBe(false);
    expect(
      supplierPayablesFilterSchema.safeParse({
        dueFromDate: "2026-02-30",
      }).success,
    ).toBe(false);
    expect(
      supplierPayablesFilterSchema.safeParse({
        dueFromDate: "2026-07-01",
        dueToDate: "2026-06-01",
      }).success,
    ).toBe(false);
  });
});
