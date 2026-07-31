import { describe, expect, it } from "vitest";

import {
  customerCreditPurchaseInputSchema,
  customerCreditPurchaseReversalSchema,
} from "@/lib/validation/customer-credit-purchases";

const customerId = "30000000-0000-4000-8000-000000000001";
const businessDayId = "40000000-0000-4000-8000-000000000001";
const shopLocationId = "41000000-0000-4000-8000-000000000001";
const purchaseId = "50000000-0000-4000-8000-000000000001";
const idempotencyKey = "70000000-0000-4000-8000-000000000001";
const productId = "51000000-0000-4000-8000-000000000001";

const baseInput = {
  customerId,
  businessDayId,
  shopLocationId,
  idempotencyKey,
  currency: "RON",
  exchangeRate: "4,50",
  lines: [
    {
      productId,
      quantity: "2",
      unitSellingPriceOriginalCurrency: "250,25",
    },
  ],
  description: "  Bathroom items  ",
  dueDate: "2026-07-10",
  auditReason: " ",
};

describe("customer credit-purchase validation", () => {
  it("normalizes a valid decimal purchase without using numbers", () => {
    expect(
      customerCreditPurchaseInputSchema.parse({
        ...baseInput,
      }),
    ).toEqual({
      customerId,
      businessDayId,
      shopLocationId,
      idempotencyKey,
      currency: "RON",
      exchangeRate: "4.5",
      lines: [
        {
          productId,
          quantity: "2",
          unitSellingPriceOriginalCurrency: "250.25",
        },
      ],
      description: "Bathroom items",
      dueDate: "2026-07-10",
      auditReason: null,
    });
  });

  it.each(["0", "-1", "1.234", "1,000.00"])(
    "rejects invalid positive line price %s",
    (unitSellingPriceOriginalCurrency) => {
      expect(
        customerCreditPurchaseInputSchema.safeParse({
          ...baseInput,
          lines: [
            {
              productId,
              quantity: "1",
              unitSellingPriceOriginalCurrency,
            },
          ],
        }).success,
      ).toBe(false);
    },
  );

  it("rejects invalid dates and oversized text", () => {
    expect(
      customerCreditPurchaseInputSchema.safeParse({
        ...baseInput,
        description: "x".repeat(501),
        dueDate: "2026-02-30",
      }).success,
    ).toBe(false);
  });

  it("requires a reason and confirmation for reversal", () => {
    expect(
      customerCreditPurchaseReversalSchema.safeParse({
        purchaseId,
        customerId,
        reason: "short",
        confirmation: undefined,
      }).success,
    ).toBe(false);
    expect(
      customerCreditPurchaseReversalSchema.safeParse({
        purchaseId,
        customerId,
        reason: "Correcting an incorrectly entered amount",
        confirmation: "confirm",
      }).success,
    ).toBe(true);
  });
});
