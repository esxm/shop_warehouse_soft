import { describe, expect, it } from "vitest";

import {
  openingBalanceReversalSchema,
  openingBalanceSchema,
  parseOpeningBalanceList,
} from "@/lib/validation/opening-balances";

const validInput = {
  openingDate: "2026-01-15",
  cashBalanceRon: "1000,5",
  bankBalanceRon: "0",
  warehouseInventoryRon: "2500.00",
  shopInventoryRon: "300.00",
  customerReceivables: [{ name: "Customer One", amountRon: "500.00" }],
  supplierPayables: [
    {
      name: "Supplier USD",
      currency: "USD",
      originalAmount: "1000.00",
      purchaseExchangeRate: "4.6000",
    },
  ],
};

describe("opening balance validation", () => {
  it("canonicalizes a valid setup without JavaScript money numbers", () => {
    const result = openingBalanceSchema.parse(validInput);

    expect(result.cashBalanceRon).toBe("1000.50");
    expect(result.bankBalanceRon).toBe("0.00");
    expect(result.customerReceivables[0]?.amountRon).toBe("500.00");
    expect(result.supplierPayables[0]?.purchaseExchangeRate).toBe("4.6");
  });

  it("rejects negative core balances", () => {
    expect(
      openingBalanceSchema.safeParse({
        ...validInput,
        cashBalanceRon: "-0.01",
      }).success,
    ).toBe(false);
  });

  it("rejects zero customer and supplier balances", () => {
    expect(
      openingBalanceSchema.safeParse({
        ...validInput,
        customerReceivables: [{ name: "Customer", amountRon: "0" }],
      }).success,
    ).toBe(false);
    expect(
      openingBalanceSchema.safeParse({
        ...validInput,
        supplierPayables: [
          {
            name: "Supplier",
            currency: "RON",
            originalAmount: "0",
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("requires a historical exchange rate for USD payables", () => {
    expect(
      openingBalanceSchema.safeParse({
        ...validInput,
        supplierPayables: [
          {
            name: "Supplier",
            currency: "USD",
            originalAmount: "100",
            purchaseExchangeRate: "",
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects exchange rates on RON payables", () => {
    expect(
      openingBalanceSchema.safeParse({
        ...validInput,
        supplierPayables: [
          {
            name: "Supplier",
            currency: "RON",
            originalAmount: "100",
            purchaseExchangeRate: "4.6",
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects invalid dates and oversized party lists", () => {
    expect(
      openingBalanceSchema.safeParse({
        ...validInput,
        openingDate: "2026-02-30",
      }).success,
    ).toBe(false);
    expect(
      openingBalanceSchema.safeParse({
        ...validInput,
        customerReceivables: Array.from({ length: 101 }, (_, index) => ({
          name: `Customer ${index}`,
          amountRon: "1.00",
        })),
      }).success,
    ).toBe(false);
  });

  it("parses only valid JSON form lists", () => {
    expect(parseOpeningBalanceList('[{"name":"Customer"}]')).toEqual([
      { name: "Customer" },
    ]);
    expect(parseOpeningBalanceList("invalid")).toBeNull();
    expect(parseOpeningBalanceList(null)).toBeNull();
  });

  it("requires a meaningful reason and explicit reversal confirmation", () => {
    const valid = {
      batchId: "b25174a5-5d11-4464-b1b7-22d5125e5a2a",
      reason: "Correcting the original cash amount",
      confirmation: "confirm",
    };

    expect(openingBalanceReversalSchema.safeParse(valid).success).toBe(true);
    expect(
      openingBalanceReversalSchema.safeParse({
        ...valid,
        reason: "mistake",
      }).success,
    ).toBe(false);
    expect(
      openingBalanceReversalSchema.safeParse({
        ...valid,
        confirmation: undefined,
      }).success,
    ).toBe(false);
  });
});
