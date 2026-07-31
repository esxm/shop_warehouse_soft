import { describe, expect, it } from "vitest";

import {
  productSaleInputSchema,
  productSaleReversalSchema,
} from "@/lib/validation/product-sales";

const baseInput = {
  businessDayId: "40000000-0000-4000-8000-000000000001",
  shopLocationId: "50000000-0000-4000-8000-000000000001",
  customerId: "",
  cashAmountRon: "23",
  bankAmountRon: "0",
  creditAmountRon: "0",
  idempotencyKey: "70000000-0000-4000-8000-000000000001",
  lines: [
    {
      productId: "51000000-0000-4000-8000-000000000001",
      quantity: "2",
      unitSellingPriceRon: "11,50",
    },
  ],
  notes: " Counter sale ",
};

describe("product sale validation", () => {
  it("normalizes an individual sale and manual selling price", () => {
    expect(productSaleInputSchema.parse(baseInput)).toEqual({
      ...baseInput,
      customerId: null,
      cashAmountRon: "23.00",
      bankAmountRon: "0.00",
      creditAmountRon: "0.00",
      lines: [
        {
          ...baseInput.lines[0],
          unitSellingPriceRon: "11.50",
        },
      ],
      notes: "Counter sale",
    });
  });

  it("accepts a mixed cash, bank, and customer-credit split", () => {
    expect(
      productSaleInputSchema.safeParse({
        ...baseInput,
        customerId: "30000000-0000-4000-8000-000000000001",
        cashAmountRon: "10",
        bankAmountRon: "5",
        creditAmountRon: "8",
      }).success,
    ).toBe(true);
  });

  it("rejects a payment split that differs from line revenue", () => {
    expect(
      productSaleInputSchema.safeParse({
        ...baseInput,
        cashAmountRon: "22.99",
      }).success,
    ).toBe(false);
  });

  it("requires a customer exactly when the sale includes credit", () => {
    expect(
      productSaleInputSchema.safeParse({
        ...baseInput,
        cashAmountRon: "0",
        creditAmountRon: "23",
      }).success,
    ).toBe(false);
    expect(
      productSaleInputSchema.safeParse({
        ...baseInput,
        customerId: "30000000-0000-4000-8000-000000000001",
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate products and fractional quantities", () => {
    expect(
      productSaleInputSchema.safeParse({
        ...baseInput,
        lines: [baseInput.lines[0], baseInput.lines[0]],
        cashAmountRon: "46",
      }).success,
    ).toBe(false);
    expect(
      productSaleInputSchema.safeParse({
        ...baseInput,
        lines: [{ ...baseInput.lines[0], quantity: "1.5" }],
      }).success,
    ).toBe(false);
  });

  it("requires explicit confirmation and a meaningful correction reason", () => {
    expect(
      productSaleReversalSchema.safeParse({
        saleId: "60000000-0000-4000-8000-000000000001",
        reason: "Wrong",
        confirmation: undefined,
      }).success,
    ).toBe(false);
    expect(
      productSaleReversalSchema.safeParse({
        saleId: "60000000-0000-4000-8000-000000000001",
        reason: "Wrong product was selected",
        confirmation: "confirm",
      }).success,
    ).toBe(true);
  });
});
