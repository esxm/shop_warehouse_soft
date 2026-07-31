import { describe, expect, it } from "vitest";

import {
  supplierPurchaseInputSchema,
  supplierPurchaseReversalSchema,
} from "@/lib/validation/supplier-purchases";

const baseInput = {
  supplierId: "30000000-0000-4000-8000-000000000001",
  businessDayId: "40000000-0000-4000-8000-000000000001",
  idempotencyKey: "70000000-0000-4000-8000-000000000001",
  destinationLocationId: "50000000-0000-4000-8000-000000000001",
  lines: [
    {
      productId: "51000000-0000-4000-8000-000000000001",
      quantity: "5",
      unitPriceOriginalCurrency: "25,10",
    },
  ],
  description: " Goods received ",
  dueDate: "2026-07-10",
  auditReason: "",
};

describe("supplier purchase validation", () => {
  it("normalizes a RON purchase with an exchange rate", () => {
    expect(
      supplierPurchaseInputSchema.parse({
        ...baseInput,
        currency: "RON",
        purchaseExchangeRate: "4,50000000",
      }),
    ).toEqual({
      ...baseInput,
      currency: "RON",
      purchaseExchangeRate: "4.5",
      lines: [
        {
          productId: "51000000-0000-4000-8000-000000000001",
          quantity: "5",
          unitPriceOriginalCurrency: "25.10",
        },
      ],
      description: "Goods received",
      auditReason: null,
    });
  });

  it("accepts and normalizes a USD historical exchange rate", () => {
    const result = supplierPurchaseInputSchema.parse({
      ...baseInput,
      currency: "USD",
      purchaseExchangeRate: "4,60000000",
    });

    expect(result.purchaseExchangeRate).toBe("4.6");
  });

  it.each([
    { currency: "USD", purchaseExchangeRate: "" },
    { currency: "RON", purchaseExchangeRate: "" },
    { currency: "EUR", purchaseExchangeRate: "" },
    { currency: "USD", purchaseExchangeRate: "0" },
  ])("rejects an invalid currency and exchange-rate combination", (values) => {
    expect(
      supplierPurchaseInputSchema.safeParse({
        ...baseInput,
        ...values,
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate products and invalid piece quantities", () => {
    const duplicateLine = baseInput.lines[0];

    expect(
      supplierPurchaseInputSchema.safeParse({
        ...baseInput,
        currency: "RON",
        purchaseExchangeRate: "4.50",
        lines: [duplicateLine, duplicateLine],
      }).success,
    ).toBe(false);
    expect(
      supplierPurchaseInputSchema.safeParse({
        ...baseInput,
        currency: "RON",
        purchaseExchangeRate: "4.50",
        lines: [{ ...duplicateLine, quantity: "1.5" }],
      }).success,
    ).toBe(false);
  });

  it("requires at least one product line", () => {
    expect(
      supplierPurchaseInputSchema.safeParse({
        ...baseInput,
        currency: "RON",
        purchaseExchangeRate: "4.50",
        lines: [],
      }).success,
    ).toBe(false);
  });

  it("requires explicit confirmation and a meaningful reversal reason", () => {
    expect(
      supplierPurchaseReversalSchema.safeParse({
        purchaseId: "60000000-0000-4000-8000-000000000001",
        supplierId: baseInput.supplierId,
        reason: "short",
        allowNegativeStock: false,
        confirmation: undefined,
      }).success,
    ).toBe(false);
    expect(
      supplierPurchaseReversalSchema.safeParse({
        purchaseId: "60000000-0000-4000-8000-000000000001",
        supplierId: baseInput.supplierId,
        reason: "Duplicate invoice was entered",
        allowNegativeStock: false,
        confirmation: "confirm",
      }).success,
    ).toBe(true);
  });
});
