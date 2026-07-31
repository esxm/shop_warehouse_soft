import { z } from "zod";

import { parseBusinessDate, type BusinessDate } from "@/lib/date/business-date";
import {
  addMoney,
  convertUsdToRon,
  parseExchangeRate,
  parseMoneyInput,
  subtractMoney,
  type ExchangeRate,
  type MoneyAmount,
} from "@/lib/money/money";
import { csvRow } from "@/lib/reports/csv";

export type SupplierPayablePurchaseSource = Readonly<{
  purchaseId: string;
  supplierId: string;
  supplierName: string;
  purchaseDate: string;
  dueDate: string | null;
  currency: "RON" | "USD";
  originalAmount: string;
  allocatedOriginalAmount: string;
  remainingOriginalAmount: string;
  status: "unpaid" | "partial" | "paid" | "reversed";
}>;

export type SupplierPayablesFilter = Readonly<{
  supplierId: string | null;
  currency: "all" | "RON" | "USD";
  outstandingOnly: boolean;
  dueFromDate: BusinessDate | null;
  dueToDate: BusinessDate | null;
}>;

export type SupplierPayableReportRow = Readonly<{
  supplierId: string;
  supplierName: string;
  currency: "RON" | "USD";
  originalPurchaseTotal: MoneyAmount;
  totalPaid: MoneyAmount;
  remainingOriginalAmount: MoneyAmount;
  estimatedRemainingRon: MoneyAmount | null;
  oldestUnpaidDate: string | null;
}>;

export type SupplierPayablesReport = Readonly<{
  rows: readonly SupplierPayableReportRow[];
  summary: Readonly<{
    totalRonPayables: MoneyAmount;
    totalUsdPayables: MoneyAmount;
    estimatedTotalRon: MoneyAmount | null;
  }>;
}>;

export type SupplierUsdAllocationEconomics = Readonly<{
  historicalRonValue: MoneyAmount;
  actualRonValue: MoneyAmount;
  currencyGainLossRon: MoneyAmount;
}>;

const optionalBusinessDateSchema = z
  .string()
  .trim()
  .default("")
  .transform((value, context) => {
    if (!value) {
      return null;
    }

    try {
      return parseBusinessDate(value);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message:
          error instanceof Error
            ? error.message
            : "Enter a valid business date.",
      });
      return z.NEVER;
    }
  });

export const supplierPayablesFilterSchema = z
  .object({
    supplierId: z
      .union([z.literal(""), z.uuid("Supplier is invalid.")])
      .default("")
      .transform((value) => value || null),
    currency: z.enum(["all", "RON", "USD"]).default("all"),
    outstandingOnly: z
      .enum(["1", "0"])
      .default("0")
      .transform((value) => value === "1"),
    dueFromDate: optionalBusinessDateSchema,
    dueToDate: optionalBusinessDateSchema,
  })
  .superRefine((filter, context) => {
    if (
      filter.dueFromDate !== null &&
      filter.dueToDate !== null &&
      filter.dueFromDate > filter.dueToDate
    ) {
      context.addIssue({
        code: "custom",
        message: "Due-from date must be on or before due-to date.",
        path: ["dueToDate"],
      });
    }
  });

type MutableSupplierRow = {
  supplierId: string;
  supplierName: string;
  currency: "RON" | "USD";
  originalPurchaseTotal: MoneyAmount;
  totalPaid: MoneyAmount;
  remainingOriginalAmount: MoneyAmount;
  oldestUnpaidDate: string | null;
};

function hasAmount(amount: MoneyAmount): boolean {
  return amount !== "0.00";
}

function purchaseMatchesScope(
  purchase: SupplierPayablePurchaseSource,
  filter: SupplierPayablesFilter,
): boolean {
  if (purchase.status === "reversed") {
    return false;
  }

  if (filter.supplierId && purchase.supplierId !== filter.supplierId) {
    return false;
  }

  if (filter.currency !== "all" && purchase.currency !== filter.currency) {
    return false;
  }

  if (filter.dueFromDate || filter.dueToDate) {
    if (!purchase.dueDate) {
      return false;
    }

    if (filter.dueFromDate && purchase.dueDate < filter.dueFromDate) {
      return false;
    }

    if (filter.dueToDate && purchase.dueDate > filter.dueToDate) {
      return false;
    }
  }

  return true;
}

function estimateRemainingRon(
  currency: "RON" | "USD",
  remaining: MoneyAmount,
  currentUsdRonRate: ExchangeRate | null,
): MoneyAmount | null {
  if (currency === "RON") {
    return remaining;
  }

  return currentUsdRonRate
    ? convertUsdToRon(remaining, currentUsdRonRate)
    : hasAmount(remaining)
      ? null
      : parseMoneyInput("0");
}

export function calculateSupplierUsdAllocationEconomics(
  allocatedUsdInput: string,
  historicalRateInput: string,
  paymentRateInput: string,
): SupplierUsdAllocationEconomics {
  const allocatedUsd = parseMoneyInput(allocatedUsdInput);
  const historicalRonValue = convertUsdToRon(
    allocatedUsd,
    parseExchangeRate(historicalRateInput),
  );
  const actualRonValue = convertUsdToRon(
    allocatedUsd,
    parseExchangeRate(paymentRateInput),
  );

  return {
    historicalRonValue,
    actualRonValue,
    currencyGainLossRon: subtractMoney(historicalRonValue, actualRonValue),
  };
}

export function buildSupplierPayablesReport(
  purchases: readonly SupplierPayablePurchaseSource[],
  filter: SupplierPayablesFilter,
  currentUsdRonRateInput: string | null,
): SupplierPayablesReport {
  const currentUsdRonRate = currentUsdRonRateInput
    ? parseExchangeRate(currentUsdRonRateInput)
    : null;
  const rowsBySupplierCurrency = new Map<string, MutableSupplierRow>();

  for (const purchase of purchases) {
    if (!purchaseMatchesScope(purchase, filter)) {
      continue;
    }

    const original = parseMoneyInput(purchase.originalAmount);
    const paid = parseMoneyInput(purchase.allocatedOriginalAmount);
    const remaining = parseMoneyInput(purchase.remainingOriginalAmount);

    if (subtractMoney(original, paid) !== remaining) {
      throw new Error("Supplier payable purchase balance is inconsistent.");
    }

    const key = `${purchase.supplierId}:${purchase.currency}`;
    const existing = rowsBySupplierCurrency.get(key) ?? {
      supplierId: purchase.supplierId,
      supplierName: purchase.supplierName,
      currency: purchase.currency,
      originalPurchaseTotal: parseMoneyInput("0"),
      totalPaid: parseMoneyInput("0"),
      remainingOriginalAmount: parseMoneyInput("0"),
      oldestUnpaidDate: null,
    };

    existing.originalPurchaseTotal = addMoney(
      existing.originalPurchaseTotal,
      original,
    );
    existing.totalPaid = addMoney(existing.totalPaid, paid);
    existing.remainingOriginalAmount = addMoney(
      existing.remainingOriginalAmount,
      remaining,
    );

    if (
      hasAmount(remaining) &&
      (existing.oldestUnpaidDate === null ||
        purchase.purchaseDate < existing.oldestUnpaidDate)
    ) {
      existing.oldestUnpaidDate = purchase.purchaseDate;
    }

    rowsBySupplierCurrency.set(key, existing);
  }

  const rows = [...rowsBySupplierCurrency.values()]
    .filter(
      (row) =>
        !filter.outstandingOnly || hasAmount(row.remainingOriginalAmount),
    )
    .sort(
      (left, right) =>
        left.supplierName.localeCompare(right.supplierName) ||
        left.currency.localeCompare(right.currency),
    )
    .map((row) => ({
      ...row,
      estimatedRemainingRon: estimateRemainingRon(
        row.currency,
        row.remainingOriginalAmount,
        currentUsdRonRate,
      ),
    }));
  const totalRonPayables = addMoney(
    ...rows
      .filter((row) => row.currency === "RON")
      .map((row) => row.remainingOriginalAmount),
  );
  const totalUsdPayables = addMoney(
    ...rows
      .filter((row) => row.currency === "USD")
      .map((row) => row.remainingOriginalAmount),
  );
  const estimatedUsdRon = estimateRemainingRon(
    "USD",
    totalUsdPayables,
    currentUsdRonRate,
  );

  return {
    rows,
    summary: {
      totalRonPayables,
      totalUsdPayables,
      estimatedTotalRon:
        estimatedUsdRon === null
          ? null
          : addMoney(totalRonPayables, estimatedUsdRon),
    },
  };
}

export function createSupplierPayablesCsv(
  report: SupplierPayablesReport,
  filter: SupplierPayablesFilter,
  currentRate: Readonly<{
    rate: string;
    effectiveDate: string;
  }> | null,
): string {
  const rateLabel = currentRate
    ? `${currentRate.rate} RON per USD, effective ${currentRate.effectiveDate}`
    : "Unavailable";
  const lines = [
    csvRow(["Supplier payables"]),
    csvRow(["Current USD/RON estimate rate", rateLabel]),
    csvRow(["Summary", "RON payables", "USD payables", "Estimated total RON"]),
    csvRow([
      "Selected scope",
      report.summary.totalRonPayables,
      report.summary.totalUsdPayables,
      report.summary.estimatedTotalRon ?? "Unavailable",
    ]),
    "",
    csvRow([
      "Supplier ID",
      "Supplier",
      "Currency",
      "Original purchases",
      "Paid",
      "Outstanding original",
      "Estimated remaining RON",
      "Oldest unpaid date",
    ]),
    ...report.rows.map((row) =>
      csvRow([
        row.supplierId,
        row.supplierName,
        row.currency,
        row.originalPurchaseTotal,
        row.totalPaid,
        row.remainingOriginalAmount,
        row.estimatedRemainingRon ?? "Unavailable",
        row.oldestUnpaidDate ?? "",
      ]),
    ),
    "",
    csvRow([
      "Filter",
      filter.currency,
      filter.outstandingOnly ? "Outstanding only" : "All purchases",
      filter.dueFromDate ? `Due from ${filter.dueFromDate}` : "",
      filter.dueToDate ? `Due through ${filter.dueToDate}` : "",
    ]),
  ];

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
