import { describe, expect, it } from "vitest";

import { parseBusinessDate } from "@/lib/date/business-date";
import {
  buildCustomerReceivablesReport,
  createCustomerReceivablesCsv,
  customerReceivablesFilterSchema,
  type CustomerReceivablePurchaseSource,
  type CustomerReceivablesFilter,
} from "@/lib/reports/customer-receivables";

const customerIds = {
  alice: "20000000-0000-4000-8000-000000000001",
  bob: "20000000-0000-4000-8000-000000000002",
};

const purchases: readonly CustomerReceivablePurchaseSource[] = [
  {
    purchaseId: "20000000-0000-4000-8000-000000000011",
    customerId: customerIds.alice,
    customerName: "Alice",
    purchaseDate: "2026-05-01",
    dueDate: "2026-05-31",
    amountRon: "100.00",
    allocatedRon: "30.00",
    remainingRon: "70.00",
    status: "partial",
  },
  {
    purchaseId: "20000000-0000-4000-8000-000000000012",
    customerId: customerIds.alice,
    customerName: "Alice",
    purchaseDate: "2026-06-01",
    dueDate: "2026-06-30",
    amountRon: "200.00",
    allocatedRon: "200.00",
    remainingRon: "0.00",
    status: "paid",
  },
  {
    purchaseId: "20000000-0000-4000-8000-000000000013",
    customerId: customerIds.alice,
    customerName: "Alice",
    purchaseDate: "2026-06-15",
    dueDate: "2026-07-31",
    amountRon: "300.00",
    allocatedRon: "100.00",
    remainingRon: "200.00",
    status: "partial",
  },
  {
    purchaseId: "20000000-0000-4000-8000-000000000014",
    customerId: customerIds.alice,
    customerName: "Alice",
    purchaseDate: "2026-06-20",
    dueDate: "2026-06-30",
    amountRon: "50.00",
    allocatedRon: "0.00",
    remainingRon: "0.00",
    status: "reversed",
  },
  {
    purchaseId: "20000000-0000-4000-8000-000000000021",
    customerId: customerIds.bob,
    customerName: "Bob",
    purchaseDate: "2026-04-01",
    dueDate: "2026-04-30",
    amountRon: "80.00",
    allocatedRon: "80.00",
    remainingRon: "0.00",
    status: "paid",
  },
];

const baseFilter: CustomerReceivablesFilter = {
  customerId: null,
  outstandingOnly: false,
  overdueOnly: false,
  fromDate: null,
  toDate: null,
};
const asOfDate = parseBusinessDate("2026-07-02");

describe("customer receivables report aggregation", () => {
  it("calculates partial and multi-purchase allocations exactly", () => {
    const report = buildCustomerReceivablesReport(
      purchases,
      baseFilter,
      asOfDate,
    );

    expect(report.rows[0]).toEqual({
      customerId: customerIds.alice,
      customerName: "Alice",
      totalPurchasesRon: "600.00",
      totalPaymentsRon: "330.00",
      remainingBalanceRon: "270.00",
      overdueAmountRon: "70.00",
      oldestUnpaidDate: "2026-05-01",
    });
    expect(report.summary).toEqual({
      totalOutstandingRon: "270.00",
      customersWithOutstanding: 1,
      overdueAmountRon: "70.00",
    });
  });

  it("excludes reversed purchases from every total", () => {
    const alice = buildCustomerReceivablesReport(
      purchases,
      { ...baseFilter, customerId: customerIds.alice },
      asOfDate,
    ).rows[0];

    expect(alice.totalPurchasesRon).toBe("600.00");
    expect(alice.remainingBalanceRon).toBe("270.00");
  });

  it("filters customer rows without changing summary accounting", () => {
    const report = buildCustomerReceivablesReport(
      purchases,
      { ...baseFilter, outstandingOnly: true },
      asOfDate,
    );

    expect(report.rows.map((row) => row.customerName)).toEqual(["Alice"]);
    expect(report.summary.customersWithOutstanding).toBe(1);
  });

  it("shows only customers with overdue remaining purchases", () => {
    const report = buildCustomerReceivablesReport(
      purchases,
      { ...baseFilter, overdueOnly: true },
      asOfDate,
    );

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].customerName).toBe("Alice");
    expect(report.rows[0].overdueAmountRon).toBe("70.00");
  });

  it("scopes purchase contributions by customer and inclusive date range", () => {
    const report = buildCustomerReceivablesReport(
      purchases,
      {
        ...baseFilter,
        customerId: customerIds.alice,
        fromDate: parseBusinessDate("2026-06-01"),
        toDate: parseBusinessDate("2026-06-30"),
      },
      asOfDate,
    );

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({
      totalPurchasesRon: "500.00",
      totalPaymentsRon: "300.00",
      remainingBalanceRon: "200.00",
      oldestUnpaidDate: "2026-06-15",
    });
  });

  it("fails closed when purchase balance components are inconsistent", () => {
    expect(() =>
      buildCustomerReceivablesReport(
        [
          {
            ...purchases[0],
            remainingRon: "71.00",
          },
        ],
        baseFilter,
        asOfDate,
      ),
    ).toThrow("balance is inconsistent");
  });

  it("exports the displayed rows and summary with exact totals", () => {
    const report = buildCustomerReceivablesReport(
      purchases,
      { ...baseFilter, outstandingOnly: true },
      asOfDate,
    );
    const csv = createCustomerReceivablesCsv(
      report,
      { ...baseFilter, outstandingOnly: true },
      asOfDate,
    );

    expect(csv).toContain('"Selected scope","270.00","1","70.00"');
    expect(csv).toContain(
      `"${customerIds.alice}","Alice","600.00","330.00","270.00","70.00","2026-05-01"`,
    );
    expect(csv).not.toContain(`"${customerIds.bob}","Bob"`);
  });
});

describe("customer receivables report filters", () => {
  it("normalizes defaults and a valid date range", () => {
    expect(
      customerReceivablesFilterSchema.parse({
        customerId: customerIds.alice,
        outstandingOnly: "1",
        overdueOnly: "0",
        fromDate: "2026-01-01",
        toDate: "2026-06-30",
      }),
    ).toEqual({
      customerId: customerIds.alice,
      outstandingOnly: true,
      overdueOnly: false,
      fromDate: "2026-01-01",
      toDate: "2026-06-30",
    });

    expect(customerReceivablesFilterSchema.parse({})).toEqual({
      customerId: null,
      outstandingOnly: true,
      overdueOnly: false,
      fromDate: null,
      toDate: null,
    });
  });

  it("rejects invalid customers, calendar dates, and reversed ranges", () => {
    expect(
      customerReceivablesFilterSchema.safeParse({
        customerId: "not-a-uuid",
      }).success,
    ).toBe(false);
    expect(
      customerReceivablesFilterSchema.safeParse({
        fromDate: "2026-02-30",
      }).success,
    ).toBe(false);
    expect(
      customerReceivablesFilterSchema.safeParse({
        fromDate: "2026-07-01",
        toDate: "2026-06-01",
      }).success,
    ).toBe(false);
  });
});
