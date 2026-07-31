import { z } from "zod";

import { parseBusinessDate, type BusinessDate } from "@/lib/date/business-date";
import {
  addMoney,
  parseMoneyInput,
  subtractMoney,
  type MoneyAmount,
} from "@/lib/money/money";
import { csvRow } from "@/lib/reports/csv";

export type CustomerReceivablePurchaseSource = Readonly<{
  purchaseId: string;
  customerId: string;
  customerName: string;
  purchaseDate: string;
  dueDate: string | null;
  amountRon: string;
  allocatedRon: string;
  remainingRon: string;
  status: "unpaid" | "partial" | "paid" | "reversed";
}>;

export type CustomerReceivablesFilter = Readonly<{
  customerId: string | null;
  outstandingOnly: boolean;
  overdueOnly: boolean;
  fromDate: BusinessDate | null;
  toDate: BusinessDate | null;
}>;

export type CustomerReceivableReportRow = Readonly<{
  customerId: string;
  customerName: string;
  totalPurchasesRon: MoneyAmount;
  totalPaymentsRon: MoneyAmount;
  remainingBalanceRon: MoneyAmount;
  overdueAmountRon: MoneyAmount;
  oldestUnpaidDate: string | null;
}>;

export type CustomerReceivablesReport = Readonly<{
  rows: readonly CustomerReceivableReportRow[];
  summary: Readonly<{
    totalOutstandingRon: MoneyAmount;
    customersWithOutstanding: number;
    overdueAmountRon: MoneyAmount;
  }>;
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

export const customerReceivablesFilterSchema = z
  .object({
    customerId: z
      .union([z.literal(""), z.uuid("Customer is invalid.")])
      .default("")
      .transform((value) => value || null),
    outstandingOnly: z
      .enum(["1", "0"])
      .default("1")
      .transform((value) => value === "1"),
    overdueOnly: z
      .enum(["1", "0"])
      .default("0")
      .transform((value) => value === "1"),
    fromDate: optionalBusinessDateSchema,
    toDate: optionalBusinessDateSchema,
  })
  .superRefine((filter, context) => {
    if (
      filter.fromDate !== null &&
      filter.toDate !== null &&
      filter.fromDate > filter.toDate
    ) {
      context.addIssue({
        code: "custom",
        message: "From date must be on or before to date.",
        path: ["toDate"],
      });
    }
  });

export type CustomerReceivablesFilterInput = z.output<
  typeof customerReceivablesFilterSchema
>;

type MutableCustomerRow = {
  customerId: string;
  customerName: string;
  totalPurchasesRon: MoneyAmount;
  totalPaymentsRon: MoneyAmount;
  remainingBalanceRon: MoneyAmount;
  overdueAmountRon: MoneyAmount;
  oldestUnpaidDate: string | null;
};

function isOutstanding(amount: MoneyAmount): boolean {
  return amount !== "0.00";
}

function isOverdue(
  purchase: CustomerReceivablePurchaseSource,
  asOfDate: BusinessDate,
): boolean {
  return (
    purchase.dueDate !== null &&
    purchase.dueDate < asOfDate &&
    parseMoneyInput(purchase.remainingRon) !== "0.00"
  );
}

function purchaseMatchesScope(
  purchase: CustomerReceivablePurchaseSource,
  filter: CustomerReceivablesFilter,
): boolean {
  if (purchase.status === "reversed") {
    return false;
  }

  if (filter.customerId && purchase.customerId !== filter.customerId) {
    return false;
  }

  if (filter.fromDate && purchase.purchaseDate < filter.fromDate) {
    return false;
  }

  return !filter.toDate || purchase.purchaseDate <= filter.toDate;
}

export function buildCustomerReceivablesReport(
  purchases: readonly CustomerReceivablePurchaseSource[],
  filter: CustomerReceivablesFilter,
  asOfDate: BusinessDate,
): CustomerReceivablesReport {
  const rowsByCustomer = new Map<string, MutableCustomerRow>();

  for (const purchase of purchases) {
    if (!purchaseMatchesScope(purchase, filter)) {
      continue;
    }

    const amount = parseMoneyInput(purchase.amountRon);
    const allocated = parseMoneyInput(purchase.allocatedRon);
    const remaining = parseMoneyInput(purchase.remainingRon);

    if (subtractMoney(amount, allocated) !== remaining) {
      throw new Error("Customer receivable purchase balance is inconsistent.");
    }

    const existing = rowsByCustomer.get(purchase.customerId) ?? {
      customerId: purchase.customerId,
      customerName: purchase.customerName,
      totalPurchasesRon: parseMoneyInput("0"),
      totalPaymentsRon: parseMoneyInput("0"),
      remainingBalanceRon: parseMoneyInput("0"),
      overdueAmountRon: parseMoneyInput("0"),
      oldestUnpaidDate: null,
    };

    existing.totalPurchasesRon = addMoney(existing.totalPurchasesRon, amount);
    existing.totalPaymentsRon = addMoney(existing.totalPaymentsRon, allocated);
    existing.remainingBalanceRon = addMoney(
      existing.remainingBalanceRon,
      remaining,
    );

    if (isOverdue(purchase, asOfDate)) {
      existing.overdueAmountRon = addMoney(
        existing.overdueAmountRon,
        remaining,
      );
    }

    if (
      isOutstanding(remaining) &&
      (existing.oldestUnpaidDate === null ||
        purchase.purchaseDate < existing.oldestUnpaidDate)
    ) {
      existing.oldestUnpaidDate = purchase.purchaseDate;
    }

    rowsByCustomer.set(purchase.customerId, existing);
  }

  const allRows = [...rowsByCustomer.values()].sort((left, right) =>
    left.customerName.localeCompare(right.customerName),
  );
  const totalOutstandingRon = addMoney(
    ...allRows.map((row) => row.remainingBalanceRon),
  );
  const overdueAmountRon = addMoney(
    ...allRows.map((row) => row.overdueAmountRon),
  );
  const customersWithOutstanding = allRows.filter((row) =>
    isOutstanding(row.remainingBalanceRon),
  ).length;
  const rows = allRows.filter((row) => {
    if (filter.outstandingOnly && !isOutstanding(row.remainingBalanceRon)) {
      return false;
    }

    return !filter.overdueOnly || isOutstanding(row.overdueAmountRon);
  });

  return {
    rows,
    summary: {
      totalOutstandingRon,
      customersWithOutstanding,
      overdueAmountRon,
    },
  };
}

export function createCustomerReceivablesCsv(
  report: CustomerReceivablesReport,
  filter: CustomerReceivablesFilter,
  asOfDate: BusinessDate,
): string {
  const scope = [
    filter.fromDate ? `from ${filter.fromDate}` : "from first purchase",
    filter.toDate ? `through ${filter.toDate}` : "through latest purchase",
    filter.outstandingOnly ? "outstanding customers only" : "all customers",
    filter.overdueOnly ? "overdue customers only" : "all due states",
  ].join("; ");
  const lines = [
    csvRow(["Customer receivables", `As of ${asOfDate}`]),
    csvRow(["Filter scope", scope]),
    csvRow(["Summary", "Outstanding RON", "Customers owing", "Overdue RON"]),
    csvRow([
      "Selected scope",
      report.summary.totalOutstandingRon,
      report.summary.customersWithOutstanding.toString(),
      report.summary.overdueAmountRon,
    ]),
    "",
    csvRow([
      "Customer ID",
      "Customer",
      "Credit purchases RON",
      "Payments RON",
      "Remaining RON",
      "Overdue RON",
      "Oldest unpaid date",
    ]),
    ...report.rows.map((row) =>
      csvRow([
        row.customerId,
        row.customerName,
        row.totalPurchasesRon,
        row.totalPaymentsRon,
        row.remainingBalanceRon,
        row.overdueAmountRon,
        row.oldestUnpaidDate ?? "",
      ]),
    ),
  ];

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
