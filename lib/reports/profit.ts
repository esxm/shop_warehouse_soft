import Decimal from "decimal.js";

import { parseBusinessDate, type BusinessDate } from "@/lib/date/business-date";
import { csvRow } from "@/lib/reports/csv";
import type { RevenueDateRange } from "@/lib/reports/revenue";

export type ProfitSourceRow = Readonly<{
  activityDate: string;
  soldQuantity: string;
  returnedQuantity: string;
  netRevenueRon: string;
  historicalCostRon: string;
  grossMarginRon: string;
}>;

export type ProfitBreakdown = Readonly<{
  soldQuantity: string;
  returnedQuantity: string;
  netRevenueRon: string;
  historicalCostRon: string;
  productProfitRon: string;
  profitPercent: string;
}>;

export type DailyProfit = ProfitBreakdown & Readonly<{ businessDate: string }>;

export type WeeklyProfit = ProfitBreakdown &
  Readonly<{ weekStart: string; weekEnd: string }>;

export type MonthlyProfit = ProfitBreakdown & Readonly<{ month: string }>;

export type ProfitReport = Readonly<{
  daily: readonly DailyProfit[];
  weekly: readonly WeeklyProfit[];
  monthly: readonly MonthlyProfit[];
  totals: ProfitBreakdown;
}>;

type MutableBreakdown = {
  soldQuantity: bigint;
  returnedQuantity: bigint;
  netRevenueRon: Decimal;
  historicalCostRon: Decimal;
  productProfitRon: Decimal;
};

function emptyBreakdown(): MutableBreakdown {
  return {
    soldQuantity: BigInt(0),
    returnedQuantity: BigInt(0),
    netRevenueRon: new Decimal(0),
    historicalCostRon: new Decimal(0),
    productProfitRon: new Decimal(0),
  };
}

function addRow(
  current: MutableBreakdown,
  row: ProfitSourceRow | ProfitBreakdown,
): MutableBreakdown {
  return {
    soldQuantity: current.soldQuantity + BigInt(row.soldQuantity),
    returnedQuantity: current.returnedQuantity + BigInt(row.returnedQuantity),
    netRevenueRon: current.netRevenueRon.plus(row.netRevenueRon),
    historicalCostRon: current.historicalCostRon.plus(row.historicalCostRon),
    productProfitRon: current.productProfitRon.plus(
      "grossMarginRon" in row ? row.grossMarginRon : row.productProfitRon,
    ),
  };
}

function finalize(value: MutableBreakdown): ProfitBreakdown {
  return {
    soldQuantity: value.soldQuantity.toString(),
    returnedQuantity: value.returnedQuantity.toString(),
    netRevenueRon: value.netRevenueRon.toFixed(2),
    historicalCostRon: value.historicalCostRon.toFixed(2),
    productProfitRon: value.productProfitRon.toFixed(2),
    profitPercent: value.historicalCostRon.isZero()
      ? "0.0000"
      : value.productProfitRon
          .dividedBy(value.historicalCostRon.abs())
          .times(100)
          .toFixed(4),
  };
}

function shiftDate(date: string, days: number): BusinessDate {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return parseBusinessDate(value.toISOString().slice(0, 10));
}

function mondayOfWeek(date: string): BusinessDate {
  const value = new Date(`${date}T00:00:00.000Z`);
  const daysSinceMonday = (value.getUTCDay() + 6) % 7;
  return shiftDate(date, -daysSinceMonday);
}

export function buildProfitReport(
  rows: readonly ProfitSourceRow[],
): ProfitReport {
  const dailyMap = new Map<string, MutableBreakdown>();
  for (const row of rows) {
    dailyMap.set(
      row.activityDate,
      addRow(dailyMap.get(row.activityDate) ?? emptyBreakdown(), row),
    );
  }

  const daily = [...dailyMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([businessDate, value]) => ({
      businessDate,
      ...finalize(value),
    }));

  const weeklyMap = new Map<string, MutableBreakdown>();
  const monthlyMap = new Map<string, MutableBreakdown>();
  for (const day of daily) {
    const weekStart = mondayOfWeek(day.businessDate);
    weeklyMap.set(
      weekStart,
      addRow(weeklyMap.get(weekStart) ?? emptyBreakdown(), day),
    );
    const month = day.businessDate.slice(0, 7);
    monthlyMap.set(
      month,
      addRow(monthlyMap.get(month) ?? emptyBreakdown(), day),
    );
  }

  const weekly = [...weeklyMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([weekStart, value]) => ({
      weekStart,
      weekEnd: shiftDate(weekStart, 6),
      ...finalize(value),
    }));
  const monthly = [...monthlyMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, value]) => ({ month, ...finalize(value) }));
  const totals = finalize(rows.reduce(addRow, emptyBreakdown()));

  return { daily, weekly, monthly, totals };
}

function breakdownCsvRow(label: string, value: ProfitBreakdown): string {
  return csvRow([
    label,
    value.soldQuantity,
    value.returnedQuantity,
    value.netRevenueRon,
    value.historicalCostRon,
    value.productProfitRon,
    value.profitPercent,
  ]);
}

export function createProfitCsv(
  report: ProfitReport,
  range: RevenueDateRange,
): string {
  const columns = [
    "Period",
    "Sold pieces",
    "Returned pieces",
    "Net product revenue RON",
    "Historical product cost RON",
    "Product profit RON",
    "Profit percent",
  ];
  const lines = [
    csvRow(["Product profit report", `${range.fromDate} to ${range.toDate}`]),
    "",
    csvRow(["Daily profit"]),
    csvRow(columns),
    ...report.daily.map((row) => breakdownCsvRow(row.businessDate, row)),
    "",
    csvRow(["Weekly profit"]),
    csvRow(columns),
    ...report.weekly.map((row) =>
      breakdownCsvRow(`${row.weekStart} to ${row.weekEnd}`, row),
    ),
    "",
    csvRow(["Monthly profit"]),
    csvRow(columns),
    ...report.monthly.map((row) => breakdownCsvRow(row.month, row)),
    "",
    breakdownCsvRow("Selected period total", report.totals),
  ];

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
