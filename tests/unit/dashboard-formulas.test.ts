import { describe, expect, it } from "vitest";

import { calculateDashboardMetrics } from "@/lib/dashboard/formulas";

const baseInput = {
  today: "2026-07-15",
  revenues: [],
  financialAccounts: [],
  receivables: [],
  payables: [],
  productInventory: [],
  usdRonRate: null,
} as const;

describe("dashboard formulas", () => {
  it("separates today's closed revenue from current-month revenue", () => {
    const metrics = calculateDashboardMetrics({
      ...baseInput,
      revenues: [
        { businessDate: "2026-07-01", totalSalesRon: "100.25" },
        { businessDate: "2026-06-30", totalSalesRon: "900.00" },
        { businessDate: "2026-07-15", totalSalesRon: "50.25" },
      ],
    });

    expect(metrics.todayRevenueRon).toBe("50.25");
    expect(metrics.currentMonthRevenueRon).toBe("150.50");
  });

  it("aggregates balances and estimates USD payables at the current rate", () => {
    const metrics = calculateDashboardMetrics({
      ...baseInput,
      financialAccounts: [
        { type: "cash", balanceRon: "1000.00" },
        { type: "bank", balanceRon: "2000.00" },
      ],
      receivables: [{ outstandingRon: "400.00" }, { outstandingRon: "100.00" }],
      payables: [
        { currency: "RON", outstandingOriginalAmount: "300.00" },
        { currency: "USD", outstandingOriginalAmount: "100.00" },
      ],
      productInventory: [
        { inventoryValueRon: "5000.00", costIsComplete: true },
        { inventoryValueRon: "1500.00", costIsComplete: true },
      ],
      usdRonRate: "4.5",
    });

    expect(metrics.customerReceivablesRon).toBe("500.00");
    expect(metrics.estimatedUsdPayablesRon).toBe("450.00");
    expect(metrics.estimatedSupplierPayablesRon).toBe("750.00");
    expect(metrics.netBusinessValueRon).toBe("9250.00");
  });

  it("does not add cumulative revenue to net business value", () => {
    const metrics = calculateDashboardMetrics({
      ...baseInput,
      revenues: [{ businessDate: "2026-07-15", totalSalesRon: "9999.00" }],
      financialAccounts: [{ type: "cash", balanceRon: "100.00" }],
      receivables: [{ outstandingRon: "50.00" }],
      productInventory: [
        { inventoryValueRon: "25.00", costIsComplete: true },
        { inventoryValueRon: "25.00", costIsComplete: true },
      ],
    });

    expect(metrics.currentMonthRevenueRon).toBe("9999.00");
    expect(metrics.netBusinessValueRon).toBe("200.00");
  });

  it("uses only fully costed product-valued inventory", () => {
    const metrics = calculateDashboardMetrics({
      ...baseInput,
      productInventory: [
        { inventoryValueRon: "125.00", costIsComplete: true },
        { inventoryValueRon: "80.00", costIsComplete: false },
      ],
    });

    expect(metrics.productValuedInventoryRon).toBe("125.00");
    expect(metrics.netBusinessValueRon).toBe("125.00");
  });

  it("withholds payable and net estimates when USD is outstanding without a rate", () => {
    const metrics = calculateDashboardMetrics({
      ...baseInput,
      payables: [
        { currency: "RON", outstandingOriginalAmount: "20.00" },
        { currency: "USD", outstandingOriginalAmount: "10.00" },
      ],
    });

    expect(metrics.estimatedUsdPayablesRon).toBeNull();
    expect(metrics.estimatedSupplierPayablesRon).toBeNull();
    expect(metrics.netBusinessValueRon).toBeNull();
  });

  it("does not require a USD rate when no USD payable is outstanding", () => {
    const metrics = calculateDashboardMetrics({
      ...baseInput,
      financialAccounts: [{ type: "cash", balanceRon: "100.00" }],
      payables: [{ currency: "RON", outstandingOriginalAmount: "20.00" }],
    });

    expect(metrics.estimatedUsdPayablesRon).toBe("0.00");
    expect(metrics.estimatedSupplierPayablesRon).toBe("20.00");
    expect(metrics.netBusinessValueRon).toBe("80.00");
  });
});
