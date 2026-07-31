import { describe, expect, it } from "vitest";

import {
  buildCashBankReport,
  cashBankReportFilterSchema,
  createCashBankReportCsv,
  type CashBankLedgerSource,
  type CashBankReportFilter,
} from "@/lib/reports/cash-bank";
import { parseBusinessDate } from "@/lib/date/business-date";

const accountId = "22000000-0000-4000-8000-000000000001";
const userId = "22000000-0000-4000-8000-000000000002";

function entry(
  input: Partial<CashBankLedgerSource> &
    Pick<CashBankLedgerSource, "id" | "entryDate" | "direction" | "amountRon">,
): CashBankLedgerSource {
  return {
    accountId,
    accountName: "Cash Register",
    accountType: "cash",
    entryType: "customer_payment",
    description: "Test entry",
    sourceEntityType: "customer_payment",
    sourceEntityId: "22000000-0000-4000-8000-000000000003",
    sourceHref: "/customers/22000000-0000-4000-8000-000000000004",
    createdBy: userId,
    createdByName: "Test User",
    createdAt: `${input.entryDate}T10:00:00.000Z`,
    reversalOfId: null,
    ...input,
  };
}

const entries: readonly CashBankLedgerSource[] = [
  entry({
    id: "22000000-0000-4000-8000-000000000011",
    entryDate: "2026-01-01",
    direction: "inflow",
    amountRon: "100.00",
    entryType: "opening_balance",
  }),
  entry({
    id: "22000000-0000-4000-8000-000000000013",
    entryDate: "2026-01-02",
    direction: "outflow",
    amountRon: "20.00",
    entryType: "expense",
    createdAt: "2026-01-02T10:00:00.000Z",
  }),
  entry({
    id: "22000000-0000-4000-8000-000000000012",
    entryDate: "2026-01-02",
    direction: "inflow",
    amountRon: "50.00",
    entryType: "customer_payment",
    createdAt: "2026-01-02T10:00:00.000Z",
  }),
  entry({
    id: "22000000-0000-4000-8000-000000000014",
    entryDate: "2026-01-03",
    direction: "outflow",
    amountRon: "50.00",
    entryType: "customer_payment_reversal",
    reversalOfId: "22000000-0000-4000-8000-000000000012",
  }),
];

const baseFilter: CashBankReportFilter = {
  accountId: null,
  fromDate: null,
  toDate: null,
  entryType: null,
};

describe("cash and bank report calculations", () => {
  it("calculates deterministic running balances by date, instant, and ID", () => {
    const account = buildCashBankReport([...entries].reverse(), baseFilter)
      .accounts[0];

    expect(account.rows.map((row) => row.id)).toEqual([
      "22000000-0000-4000-8000-000000000011",
      "22000000-0000-4000-8000-000000000012",
      "22000000-0000-4000-8000-000000000013",
      "22000000-0000-4000-8000-000000000014",
    ]);
    expect(account.rows.map((row) => row.runningBalanceRon)).toEqual([
      "100.00",
      "150.00",
      "130.00",
      "80.00",
    ]);
    expect(account.currentBalanceRon).toBe("80.00");
  });

  it("uses pre-range ledger movement as opening balance", () => {
    const account = buildCashBankReport(entries, {
      ...baseFilter,
      fromDate: parseBusinessDate("2026-01-02"),
      toDate: parseBusinessDate("2026-01-03"),
    }).accounts[0];

    expect(account.openingBalanceRon).toBe("100.00");
    expect(account.totalInflowsRon).toBe("50.00");
    expect(account.totalOutflowsRon).toBe("70.00");
    expect(account.periodEndingBalanceRon).toBe("80.00");
  });

  it("shows reversals as compensating rows", () => {
    const reversal = buildCashBankReport(entries, baseFilter).accounts[0]
      .rows[3];

    expect(reversal.isReversal).toBe(true);
    expect(reversal.outflowRon).toBe("50.00");
    expect(reversal.runningBalanceRon).toBe("80.00");
  });

  it("keeps actual running balances when transaction type hides rows", () => {
    const account = buildCashBankReport(entries, {
      ...baseFilter,
      entryType: "expense",
    }).accounts[0];

    expect(account.rows).toHaveLength(1);
    expect(account.rows[0].runningBalanceRon).toBe("130.00");
    expect(account.totalOutflowsRon).toBe("20.00");
    expect(account.currentBalanceRon).toBe("80.00");
  });

  it("exports deterministic running balances, users, sources, and reversals", () => {
    const report = buildCashBankReport(entries, baseFilter);
    const csv = createCashBankReportCsv(report, baseFilter);

    expect(csv).toContain('"Current balance","80.00"');
    expect(csv).toContain(
      '"22000000-0000-4000-8000-000000000014","2026-01-03"',
    );
    expect(csv).toContain('"Test User","Yes"');
  });
});

describe("cash and bank report filters", () => {
  it("normalizes defaults and valid filters", () => {
    expect(cashBankReportFilterSchema.parse({})).toEqual(baseFilter);
    expect(
      cashBankReportFilterSchema.parse({
        accountId,
        fromDate: "2026-01-01",
        toDate: "2026-01-31",
        entryType: "customer_payment",
      }),
    ).toEqual({
      accountId,
      fromDate: "2026-01-01",
      toDate: "2026-01-31",
      entryType: "customer_payment",
    });
  });

  it("rejects invalid account, date, type, and reversed range filters", () => {
    expect(
      cashBankReportFilterSchema.safeParse({ accountId: "bad" }).success,
    ).toBe(false);
    expect(
      cashBankReportFilterSchema.safeParse({
        fromDate: "2026-02-30",
      }).success,
    ).toBe(false);
    expect(
      cashBankReportFilterSchema.safeParse({
        entryType: "bad type!",
      }).success,
    ).toBe(false);
    expect(
      cashBankReportFilterSchema.safeParse({
        fromDate: "2026-02-01",
        toDate: "2026-01-01",
      }).success,
    ).toBe(false);
  });
});
