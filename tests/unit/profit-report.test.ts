import { describe, expect, it } from "vitest";

import { parseBusinessDate } from "@/lib/date/business-date";
import {
  buildProfitReport,
  createProfitCsv,
  type ProfitSourceRow,
} from "@/lib/reports/profit";

const rows: ProfitSourceRow[] = [
  {
    activityDate: "2026-06-29",
    soldQuantity: "10",
    returnedQuantity: "0",
    netRevenueRon: "100.00",
    historicalCostRon: "60.00",
    grossMarginRon: "40.00",
  },
  {
    activityDate: "2026-07-05",
    soldQuantity: "5",
    returnedQuantity: "1",
    netRevenueRon: "50.00",
    historicalCostRon: "30.00",
    grossMarginRon: "20.00",
  },
  {
    activityDate: "2026-07-06",
    soldQuantity: "3",
    returnedQuantity: "0",
    netRevenueRon: "30.00",
    historicalCostRon: "20.00",
    grossMarginRon: "10.00",
  },
];

describe("product profit report", () => {
  const report = buildProfitReport(rows);

  it("calculates exact selected-period profit and percentage", () => {
    expect(report.totals).toEqual({
      soldQuantity: "18",
      returnedQuantity: "1",
      netRevenueRon: "180.00",
      historicalCostRon: "110.00",
      productProfitRon: "70.00",
      profitPercent: "63.6364",
    });
  });

  it("keeps one exact total for each activity day", () => {
    expect(report.daily.map((row) => row.productProfitRon)).toEqual([
      "40.00",
      "20.00",
      "10.00",
    ]);
  });

  it("groups Monday through Sunday as a week", () => {
    expect(report.weekly).toHaveLength(2);
    expect(report.weekly[0]).toMatchObject({
      weekStart: "2026-06-29",
      weekEnd: "2026-07-05",
      netRevenueRon: "150.00",
      historicalCostRon: "90.00",
      productProfitRon: "60.00",
      profitPercent: "66.6667",
    });
  });

  it("groups profit by calendar month", () => {
    expect(report.monthly).toEqual([
      expect.objectContaining({ month: "2026-06", productProfitRon: "40.00" }),
      expect.objectContaining({ month: "2026-07", productProfitRon: "30.00" }),
    ]);
  });

  it("exports daily, weekly, monthly, and selected-period totals", () => {
    const csv = createProfitCsv(report, {
      fromDate: parseBusinessDate("2026-06-29"),
      toDate: parseBusinessDate("2026-07-06"),
      preset: "custom",
    });

    expect(csv).toContain('"Daily profit"');
    expect(csv).toContain('"Weekly profit"');
    expect(csv).toContain('"Monthly profit"');
    expect(csv).toContain('"Selected period total"');
    expect(csv).toContain('"70.00"');
  });

  it("returns zero percentage for an empty report", () => {
    expect(buildProfitReport([]).totals.profitPercent).toBe("0.0000");
  });
});
