import { z } from "zod";

import { parseBusinessDate, type BusinessDate } from "@/lib/date/business-date";
import {
  addMoney,
  parseMoneyInput,
  subtractMoney,
  type MoneyAmount,
} from "@/lib/money/money";
import { csvRow } from "@/lib/reports/csv";

export type CashBankLedgerSource = Readonly<{
  id: string;
  accountId: string;
  accountName: string;
  accountType: "cash" | "bank";
  entryDate: string;
  direction: "inflow" | "outflow";
  amountRon: string;
  entryType: string;
  description: string | null;
  sourceEntityType: string;
  sourceEntityId: string;
  sourceHref: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  reversalOfId: string | null;
}>;

export type CashBankAccountSource = Readonly<{
  id: string;
  name: string;
  type: "cash" | "bank";
  balanceRon: string;
}>;

export type CashBankReportFilter = Readonly<{
  accountId: string | null;
  fromDate: BusinessDate | null;
  toDate: BusinessDate | null;
  entryType: string | null;
}>;

export type CashBankReportRow = CashBankLedgerSource &
  Readonly<{
    inflowRon: MoneyAmount;
    outflowRon: MoneyAmount;
    runningBalanceRon: MoneyAmount;
    isReversal: boolean;
  }>;

export type CashBankAccountReport = Readonly<{
  accountId: string;
  accountName: string;
  accountType: "cash" | "bank";
  openingBalanceRon: MoneyAmount;
  totalInflowsRon: MoneyAmount;
  totalOutflowsRon: MoneyAmount;
  periodEndingBalanceRon: MoneyAmount;
  currentBalanceRon: MoneyAmount;
  rows: readonly CashBankReportRow[];
}>;

export type CashBankReport = Readonly<{
  accounts: readonly CashBankAccountReport[];
  transactionTypes: readonly string[];
}>;

const optionalDateSchema = z
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
          error instanceof Error ? error.message : "Enter a valid ledger date.",
      });
      return z.NEVER;
    }
  });

export const cashBankReportFilterSchema = z
  .object({
    accountId: z
      .union([z.literal(""), z.uuid("Account filter is invalid.")])
      .default("")
      .transform((value) => value || null),
    fromDate: optionalDateSchema,
    toDate: optionalDateSchema,
    entryType: z
      .string()
      .trim()
      .default("")
      .refine(
        (value) => value === "" || /^[a-z0-9_]+$/.test(value),
        "Transaction type filter is invalid.",
      )
      .transform((value) => value || null),
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

function signedBalance(
  balance: MoneyAmount,
  entry: CashBankLedgerSource,
): MoneyAmount {
  const amount = parseMoneyInput(entry.amountRon);
  return entry.direction === "inflow"
    ? addMoney(balance, amount)
    : subtractMoney(balance, amount);
}

function compareEntries(
  left: CashBankLedgerSource,
  right: CashBankLedgerSource,
): number {
  return (
    left.entryDate.localeCompare(right.entryDate) ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id)
  );
}

export function buildCashBankReport(
  entries: readonly CashBankLedgerSource[],
  filter: CashBankReportFilter,
  accountSources?: readonly CashBankAccountSource[],
): CashBankReport {
  const scopedEntries = entries
    .filter(
      (entry) => !filter.accountId || entry.accountId === filter.accountId,
    )
    .sort(compareEntries);
  const transactionTypes = [
    ...new Set(entries.map((entry) => entry.entryType)),
  ].sort();
  const derivedAccountSources: readonly CashBankAccountSource[] = [
    ...new Map(
      scopedEntries.map((entry) => [
        entry.accountId,
        {
          id: entry.accountId,
          name: entry.accountName,
          type: entry.accountType,
          balanceRon: "0.00",
        },
      ]),
    ).values(),
  ];
  const scopedAccounts = (accountSources ?? derivedAccountSources).filter(
    (account) => !filter.accountId || account.id === filter.accountId,
  );
  const accountKeys = scopedAccounts.map((account) => account.id);
  const accounts = accountKeys.map((accountId) => {
    const accountSource = scopedAccounts.find(
      (account) => account.id === accountId,
    );
    const accountEntries = scopedEntries.filter(
      (entry) => entry.accountId === accountId,
    );
    const firstEntry = accountEntries[0];
    let currentBalanceRon = parseMoneyInput("0");
    let openingBalanceRon = parseMoneyInput("0");

    for (const entry of accountEntries) {
      currentBalanceRon = signedBalance(currentBalanceRon, entry);
      if (filter.fromDate && entry.entryDate < filter.fromDate) {
        openingBalanceRon = signedBalance(openingBalanceRon, entry);
      }
    }

    const periodEntries = accountEntries.filter(
      (entry) =>
        (!filter.fromDate || entry.entryDate >= filter.fromDate) &&
        (!filter.toDate || entry.entryDate <= filter.toDate),
    );
    let runningBalanceRon = openingBalanceRon;
    let totalInflowsRon = parseMoneyInput("0");
    let totalOutflowsRon = parseMoneyInput("0");
    const rows: CashBankReportRow[] = [];

    for (const entry of periodEntries) {
      runningBalanceRon = signedBalance(runningBalanceRon, entry);

      if (filter.entryType && entry.entryType !== filter.entryType) {
        continue;
      }

      const amount = parseMoneyInput(entry.amountRon);
      const inflowRon =
        entry.direction === "inflow" ? amount : parseMoneyInput("0");
      const outflowRon =
        entry.direction === "outflow" ? amount : parseMoneyInput("0");
      totalInflowsRon = addMoney(totalInflowsRon, inflowRon);
      totalOutflowsRon = addMoney(totalOutflowsRon, outflowRon);
      rows.push({
        ...entry,
        inflowRon,
        outflowRon,
        runningBalanceRon,
        isReversal:
          entry.reversalOfId !== null || entry.entryType.endsWith("_reversal"),
      });
    }

    return {
      accountId,
      accountName: accountSource?.name ?? firstEntry?.accountName ?? "Account",
      accountType: accountSource?.type ?? firstEntry?.accountType ?? "cash",
      openingBalanceRon,
      totalInflowsRon,
      totalOutflowsRon,
      periodEndingBalanceRon: runningBalanceRon,
      currentBalanceRon,
      rows,
    };
  });

  return { accounts, transactionTypes };
}

export function createCashBankReportCsv(
  report: CashBankReport,
  filter: CashBankReportFilter,
): string {
  const lines = [
    csvRow([
      "Cash and bank report",
      filter.fromDate ? `From ${filter.fromDate}` : "From first entry",
      filter.toDate ? `Through ${filter.toDate}` : "Through latest entry",
      filter.entryType
        ? `Transaction type ${filter.entryType}`
        : "All transaction types",
    ]),
  ];

  for (const account of report.accounts) {
    lines.push(
      "",
      csvRow([
        account.accountName,
        account.accountType,
        "Opening balance",
        account.openingBalanceRon,
        "Selected inflows",
        account.totalInflowsRon,
        "Selected outflows",
        account.totalOutflowsRon,
        "Period ending balance",
        account.periodEndingBalanceRon,
        "Current balance",
        account.currentBalanceRon,
      ]),
      csvRow([
        "Entry ID",
        "Date",
        "Created at",
        "Type",
        "Description",
        "Inflow RON",
        "Outflow RON",
        "Running balance RON",
        "Source type",
        "Source ID",
        "Source link",
        "User",
        "Reversal",
      ]),
      ...account.rows.map((row) =>
        csvRow([
          row.id,
          row.entryDate,
          row.createdAt,
          row.entryType,
          row.description ?? "",
          row.inflowRon,
          row.outflowRon,
          row.runningBalanceRon,
          row.sourceEntityType,
          row.sourceEntityId,
          row.sourceHref,
          row.createdByName,
          row.isReversal ? "Yes" : "No",
        ]),
      ),
    );
  }

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
