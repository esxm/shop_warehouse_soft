import { describe, expect, it } from "vitest";

import {
  buildRevenueReport,
  createRevenueCsv,
  getRevenuePresetRange,
  resolveRevenueQuery,
  resolveRevenueQueryForTimeZone,
} from "@/lib/reports/revenue";
import { parseBusinessDate } from "@/lib/date/business-date";

const rows = [
  {
    businessDate: "2026-01-31",
    cashSalesRon: "100.10",
    bankSalesRon: "20.20",
    creditSalesRon: "3.30",
    totalSalesRon: "123.60",
  },
  {
    businessDate: "2026-02-01",
    cashSalesRon: "10.00",
    bankSalesRon: "20.00",
    creditSalesRon: "30.00",
    totalSalesRon: "60.00",
  },
  {
    businessDate: "2026-02-01",
    cashSalesRon: "1.00",
    bankSalesRon: "2.00",
    creditSalesRon: "3.00",
    totalSalesRon: "6.00",
  },
] as const;

describe("revenue report aggregation", () => {
  it("aggregates exact daily, monthly, and selected-range totals", () => {
    const report = buildRevenueReport(rows);

    expect(report.daily).toHaveLength(2);
    expect(report.daily[1]).toMatchObject({
      businessDate: "2026-02-01",
      cashSalesRon: "11.00",
      bankSalesRon: "22.00",
      creditSalesRon: "33.00",
      totalRevenueRon: "66.00",
    });
    expect(report.monthly).toEqual([
      {
        month: "2026-01",
        cashSalesRon: "100.10",
        bankSalesRon: "20.20",
        creditSalesRon: "3.30",
        totalRevenueRon: "123.60",
      },
      {
        month: "2026-02",
        cashSalesRon: "11.00",
        bankSalesRon: "22.00",
        creditSalesRon: "33.00",
        totalRevenueRon: "66.00",
      },
    ]);
    expect(report.totals).toEqual({
      cashSalesRon: "111.10",
      bankSalesRon: "42.20",
      creditSalesRon: "36.30",
      totalRevenueRon: "189.60",
    });
  });

  it("returns zero totals for an empty range", () => {
    expect(buildRevenueReport([]).totals).toEqual({
      cashSalesRon: "0.00",
      bankSalesRon: "0.00",
      creditSalesRon: "0.00",
      totalRevenueRon: "0.00",
    });
  });

  it("exports the same daily, monthly, and selected totals to CSV", () => {
    const report = buildRevenueReport(rows);
    const range = {
      fromDate: parseBusinessDate("2026-01-31"),
      toDate: parseBusinessDate("2026-02-01"),
      preset: "custom" as const,
    };
    const csv = createRevenueCsv(report, range);

    expect(csv).toContain('"2026-02-01","11.00","22.00","33.00","66.00"');
    expect(csv).toContain('"2026-02","11.00","22.00","33.00","66.00"');
    expect(
      csv.match(/"Selected range total","111.10","42.20","36.30","189.60"/g),
    ).toHaveLength(2);
  });
});

describe("revenue date ranges", () => {
  it("uses Monday through the business's current date for current week", () => {
    expect(
      getRevenuePresetRange(parseBusinessDate("2026-07-01"), "current_week"),
    ).toEqual({
      fromDate: "2026-06-29",
      toDate: "2026-07-01",
      preset: "current_week",
    });
  });

  it("handles previous-month boundaries across years and leap years", () => {
    expect(
      getRevenuePresetRange(parseBusinessDate("2028-03-15"), "previous_month"),
    ).toEqual({
      fromDate: "2028-02-01",
      toDate: "2028-02-29",
      preset: "previous_month",
    });
    expect(
      getRevenuePresetRange(parseBusinessDate("2026-01-10"), "previous_month"),
    ).toEqual({
      fromDate: "2025-12-01",
      toDate: "2025-12-31",
      preset: "previous_month",
    });
  });

  it("derives presets from the business timezone rather than UTC", () => {
    const result = resolveRevenueQueryForTimeZone(
      { preset: "today" },
      "Europe/Bucharest",
      () => new Date("2026-03-31T21:30:00Z"),
    );

    expect(result.range).toEqual({
      fromDate: "2026-04-01",
      toDate: "2026-04-01",
      preset: "today",
    });
  });

  it("accepts valid custom ranges and rejects reversed ranges", () => {
    expect(
      resolveRevenueQuery(
        { from: "2026-06-01", to: "2026-06-30" },
        parseBusinessDate("2026-07-01"),
      ),
    ).toEqual({
      range: {
        fromDate: "2026-06-01",
        toDate: "2026-06-30",
        preset: "custom",
      },
      error: null,
    });

    const invalid = resolveRevenueQuery(
      { from: "2026-06-30", to: "2026-06-01" },
      parseBusinessDate("2026-07-01"),
    );

    expect(invalid.error).toBe("From date must be on or before to date.");
    expect(invalid.range.preset).toBe("current_month");
  });
});
