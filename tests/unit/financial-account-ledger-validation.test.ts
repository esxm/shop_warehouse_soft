import { describe, expect, it } from "vitest";

import { financialAccountLedgerFilterSchema } from "@/lib/validation/financial-account-ledger";

describe("financial account ledger filters", () => {
  it("normalizes empty filters", () => {
    expect(
      financialAccountLedgerFilterSchema.parse({
        accountId: "",
        fromDate: "",
        toDate: "",
      }),
    ).toEqual({
      accountId: null,
      fromDate: null,
      toDate: null,
    });
  });

  it("accepts an account and inclusive date range", () => {
    expect(
      financialAccountLedgerFilterSchema.parse({
        accountId: "50000000-0000-4000-8000-000000000001",
        fromDate: "2026-01-01",
        toDate: "2026-01-31",
      }),
    ).toEqual({
      accountId: "50000000-0000-4000-8000-000000000001",
      fromDate: "2026-01-01",
      toDate: "2026-01-31",
    });
  });

  it.each([
    {
      accountId: "not-an-account",
      fromDate: "",
      toDate: "",
    },
    {
      accountId: "",
      fromDate: "2026-02-30",
      toDate: "",
    },
  ])("rejects malformed filter values", (filter) => {
    expect(financialAccountLedgerFilterSchema.safeParse(filter).success).toBe(
      false,
    );
  });

  it("rejects a reversed date range", () => {
    expect(
      financialAccountLedgerFilterSchema.safeParse({
        accountId: "",
        fromDate: "2026-02-01",
        toDate: "2026-01-01",
      }).success,
    ).toBe(false);
  });
});
