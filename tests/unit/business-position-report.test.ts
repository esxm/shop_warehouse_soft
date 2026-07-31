import { describe, expect, it } from "vitest";

import {
  buildBusinessPosition,
  buildBusinessPositionTrend,
  businessPositionFilterSchema,
} from "@/lib/reports/business-position";

const source = {
  inventoryLocations: [
    { type: "warehouse", balanceRon: "5000.00" },
    { type: "shop", balanceRon: "1500.00" },
  ],
  financialAccounts: [
    { type: "cash", balanceRon: "1000.00" },
    { type: "bank", balanceRon: "2000.00" },
  ],
  receivables: [{ outstandingRon: "500.00" }],
  payables: [
    { currency: "RON", outstandingOriginalAmount: "300.00" },
    { currency: "USD", outstandingOriginalAmount: "100.00" },
  ],
} as const;

describe("business-position report", () => {
  it("shows each asset and liability exactly once without a revenue input", () => {
    const position = buildBusinessPosition(source, "4.5");

    expect(position.totalAssetsRon).toBe("10000.00");
    expect(position.estimatedUsdPayablesRon).toBe("450.00");
    expect(position.estimatedSupplierPayablesRon).toBe("750.00");
    expect(position.netBusinessValueRon).toBe("9250.00");
  });

  it("changes only the USD liability estimate when the selected rate changes", () => {
    const lowRate = buildBusinessPosition(source, "4.5");
    const highRate = buildBusinessPosition(source, "5");

    expect(lowRate.estimatedSupplierPayablesRon).toBe("750.00");
    expect(highRate.estimatedSupplierPayablesRon).toBe("800.00");
    expect(lowRate.netBusinessValueRon).toBe("9250.00");
    expect(highRate.netBusinessValueRon).toBe("9200.00");
    expect(lowRate.totalAssetsRon).toBe(highRate.totalAssetsRon);
  });

  it("requires a rate only while USD supplier debt is outstanding", () => {
    expect(buildBusinessPosition(source, null).netBusinessValueRon).toBeNull();

    const ronOnly = buildBusinessPosition(
      { ...source, payables: source.payables.slice(0, 1) },
      null,
    );

    expect(ronOnly.estimatedUsdPayablesRon).toBe("0.00");
    expect(ronOnly.netBusinessValueRon).toBe("9700.00");
    expect(ronOnly.usesExchangeRateEstimate).toBe(false);
  });

  it("validates optional manually entered exchange rates", () => {
    expect(businessPositionFilterSchema.parse({}).usdRonRate).toBeNull();
    expect(
      businessPositionFilterSchema.parse({ usdRonRate: "4.75000000" })
        .usdRonRate,
    ).toBe("4.75");
    expect(
      businessPositionFilterSchema.safeParse({ usdRonRate: "0" }).success,
    ).toBe(false);
  });

  it("orders snapshots deterministically and labels change separately", () => {
    const snapshots = [
      {
        id: "b",
        snapshotDate: "2026-07-02",
        warehouseInventoryRon: "5000.00",
        shopInventoryRon: "1500.00",
        cashRon: "1100.00",
        bankRon: "2000.00",
        customerReceivablesRon: "500.00",
        supplierPayablesRon: "300.00",
        supplierPayablesUsd: "100.00",
        usdRonRate: "4.50000000",
        estimatedUsdPayablesRon: "450.00",
        estimatedSupplierPayablesRon: "750.00",
        totalAssetsRon: "10100.00",
        netBusinessValueRon: "9350.00",
        createdBy: "admin",
        createdByName: "Admin",
        createdAt: "2026-07-02T10:00:00Z",
      },
      {
        id: "a",
        snapshotDate: "2026-07-01",
        warehouseInventoryRon: "5000.00",
        shopInventoryRon: "1500.00",
        cashRon: "1000.00",
        bankRon: "2000.00",
        customerReceivablesRon: "500.00",
        supplierPayablesRon: "300.00",
        supplierPayablesUsd: "100.00",
        usdRonRate: "4.50000000",
        estimatedUsdPayablesRon: "450.00",
        estimatedSupplierPayablesRon: "750.00",
        totalAssetsRon: "10000.00",
        netBusinessValueRon: "9250.00",
        createdBy: "admin",
        createdByName: "Admin",
        createdAt: "2026-07-01T10:00:00Z",
      },
    ] as const;

    const trend = buildBusinessPositionTrend(snapshots);

    expect(trend.map((point) => point.id)).toEqual(["a", "b"]);
    expect(trend[0]?.changeFromPreviousRon).toBeNull();
    expect(trend[1]?.changeFromPreviousRon).toBe("100.00");
  });
});
