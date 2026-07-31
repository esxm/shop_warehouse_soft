import { z } from "zod";

import {
  getTodayInBusinessTimeZone,
  parseBusinessDate,
  type BusinessDate,
} from "@/lib/date/business-date";
import { addMoney, parseMoneyInput, type MoneyAmount } from "@/lib/money/money";
import { csvRow } from "@/lib/reports/csv";

export const revenuePresets = [
  "today",
  "current_week",
  "current_month",
  "previous_month",
] as const;

export type RevenuePreset = (typeof revenuePresets)[number];

export type RevenueDateRange = Readonly<{
  fromDate: BusinessDate;
  toDate: BusinessDate;
  preset: RevenuePreset | "custom";
}>;

export type RevenueSourceRow = Readonly<{
  businessDate: string;
  cashSalesRon: string;
  bankSalesRon: string;
  creditSalesRon: string;
  totalSalesRon: string;
}>;

export type RevenueBreakdown = Readonly<{
  cashSalesRon: MoneyAmount;
  bankSalesRon: MoneyAmount;
  creditSalesRon: MoneyAmount;
  totalRevenueRon: MoneyAmount;
}>;

export type DailyRevenue = RevenueBreakdown &
  Readonly<{
    businessDate: string;
  }>;

export type MonthlyRevenue = RevenueBreakdown &
  Readonly<{
    month: string;
  }>;

export type RevenueReport = Readonly<{
  daily: readonly DailyRevenue[];
  monthly: readonly MonthlyRevenue[];
  totals: RevenueBreakdown;
}>;

export type ResolvedRevenueQuery = Readonly<{
  range: RevenueDateRange;
  error: string | null;
}>;

const businessDateSchema = z.string().transform((value, context) => {
  try {
    return parseBusinessDate(value);
  } catch (error) {
    context.addIssue({
      code: "custom",
      message:
        error instanceof Error ? error.message : "Enter a valid business date.",
    });
    return z.NEVER;
  }
});

const customRangeSchema = z
  .object({
    fromDate: businessDateSchema,
    toDate: businessDateSchema,
  })
  .superRefine((range, context) => {
    if (range.fromDate > range.toDate) {
      context.addIssue({
        code: "custom",
        message: "From date must be on or before to date.",
        path: ["toDate"],
      });
    }
  });

function dateFromUtc(value: Date): BusinessDate {
  return parseBusinessDate(value.toISOString().slice(0, 10));
}

function addDays(date: BusinessDate, days: number): BusinessDate {
  const instant = new Date(`${date}T00:00:00.000Z`);
  instant.setUTCDate(instant.getUTCDate() + days);
  return dateFromUtc(instant);
}

function firstDayOfMonth(date: BusinessDate): BusinessDate {
  return parseBusinessDate(`${date.slice(0, 7)}-01`);
}

export function getRevenuePresetRange(
  today: BusinessDate,
  preset: RevenuePreset,
): RevenueDateRange {
  if (preset === "today") {
    return { fromDate: today, toDate: today, preset };
  }

  if (preset === "current_week") {
    const weekday = new Date(`${today}T00:00:00.000Z`).getUTCDay();
    const daysSinceMonday = (weekday + 6) % 7;

    return {
      fromDate: addDays(today, -daysSinceMonday),
      toDate: today,
      preset,
    };
  }

  const currentMonthStart = firstDayOfMonth(today);

  if (preset === "current_month") {
    return {
      fromDate: currentMonthStart,
      toDate: today,
      preset,
    };
  }

  const previousMonthEnd = addDays(currentMonthStart, -1);

  return {
    fromDate: firstDayOfMonth(previousMonthEnd),
    toDate: previousMonthEnd,
    preset,
  };
}

function firstQueryValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function resolveRevenueQuery(
  query: Readonly<Record<string, string | string[] | undefined>>,
  today: BusinessDate,
): ResolvedRevenueQuery {
  const presetValue = firstQueryValue(query.preset);

  if (presetValue && revenuePresets.includes(presetValue as RevenuePreset)) {
    return {
      range: getRevenuePresetRange(today, presetValue as RevenuePreset),
      error: null,
    };
  }

  const fromDate = firstQueryValue(query.from);
  const toDate = firstQueryValue(query.to);

  if (fromDate !== undefined || toDate !== undefined) {
    const result = customRangeSchema.safeParse({ fromDate, toDate });

    if (result.success) {
      return {
        range: {
          fromDate: result.data.fromDate,
          toDate: result.data.toDate,
          preset: "custom",
        },
        error: null,
      };
    }

    return {
      range: getRevenuePresetRange(today, "current_month"),
      error: result.error.issues[0]?.message ?? "Check the report date range.",
    };
  }

  if (presetValue) {
    return {
      range: getRevenuePresetRange(today, "current_month"),
      error: "Unknown report preset.",
    };
  }

  return {
    range: getRevenuePresetRange(today, "current_month"),
    error: null,
  };
}

export function resolveRevenueQueryForTimeZone(
  query: Readonly<Record<string, string | string[] | undefined>>,
  timeZone: string,
  clock: () => Date = () => new Date(),
): ResolvedRevenueQuery {
  return resolveRevenueQuery(
    query,
    getTodayInBusinessTimeZone(timeZone, clock),
  );
}

function emptyBreakdown(): RevenueBreakdown {
  const zero = parseMoneyInput("0");

  return {
    cashSalesRon: zero,
    bankSalesRon: zero,
    creditSalesRon: zero,
    totalRevenueRon: zero,
  };
}

function addBreakdown(
  current: RevenueBreakdown,
  row: RevenueSourceRow,
): RevenueBreakdown {
  return {
    cashSalesRon: addMoney(
      current.cashSalesRon,
      parseMoneyInput(row.cashSalesRon),
    ),
    bankSalesRon: addMoney(
      current.bankSalesRon,
      parseMoneyInput(row.bankSalesRon),
    ),
    creditSalesRon: addMoney(
      current.creditSalesRon,
      parseMoneyInput(row.creditSalesRon),
    ),
    totalRevenueRon: addMoney(
      current.totalRevenueRon,
      parseMoneyInput(row.totalSalesRon),
    ),
  };
}

export function buildRevenueReport(
  rows: readonly RevenueSourceRow[],
): RevenueReport {
  const dailyMap = new Map<string, RevenueBreakdown>();

  for (const row of rows) {
    dailyMap.set(
      row.businessDate,
      addBreakdown(dailyMap.get(row.businessDate) ?? emptyBreakdown(), row),
    );
  }

  const daily = [...dailyMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([businessDate, breakdown]) => ({ businessDate, ...breakdown }));
  const monthlyMap = new Map<string, RevenueBreakdown>();

  for (const day of daily) {
    const month = day.businessDate.slice(0, 7);
    monthlyMap.set(
      month,
      addBreakdown(monthlyMap.get(month) ?? emptyBreakdown(), {
        businessDate: day.businessDate,
        cashSalesRon: day.cashSalesRon,
        bankSalesRon: day.bankSalesRon,
        creditSalesRon: day.creditSalesRon,
        totalSalesRon: day.totalRevenueRon,
      }),
    );
  }

  const monthly = [...monthlyMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, breakdown]) => ({ month, ...breakdown }));
  const totals = rows.reduce(addBreakdown, emptyBreakdown());

  return { daily, monthly, totals };
}

function breakdownCsvRow(label: string, breakdown: RevenueBreakdown): string {
  return csvRow([
    label,
    breakdown.cashSalesRon,
    breakdown.bankSalesRon,
    breakdown.creditSalesRon,
    breakdown.totalRevenueRon,
  ]);
}

export function createRevenueCsv(
  report: RevenueReport,
  range: RevenueDateRange,
): string {
  const columns = [
    "Period",
    "Cash sales RON",
    "Bank sales RON",
    "Credit sales RON",
    "Total revenue RON",
  ];
  const lines = [
    csvRow(["Daily revenue", `${range.fromDate} to ${range.toDate}`]),
    csvRow(columns),
    ...report.daily.map((day) => breakdownCsvRow(day.businessDate, day)),
    breakdownCsvRow("Selected range total", report.totals),
    "",
    csvRow(["Monthly aggregation"]),
    csvRow(columns),
    ...report.monthly.map((month) => breakdownCsvRow(month.month, month)),
    breakdownCsvRow("Selected range total", report.totals),
  ];

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
