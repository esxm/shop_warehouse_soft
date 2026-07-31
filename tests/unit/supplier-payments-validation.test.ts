import { describe, expect, it } from "vitest";

import {
  supplierPaymentInputSchema,
  supplierPaymentReversalSchema,
} from "@/lib/validation/supplier-payments";

const baseInput = {
  supplierId: "30000000-0000-4000-8000-000000000001",
  businessDayId: "40000000-0000-4000-8000-000000000001",
  financialAccountId: "50000000-0000-4000-8000-000000000001",
  idempotencyKey: "60000000-0000-4000-8000-000000000001",
  notes: " Supplier payment ",
  allocationStrategy: "oldest_first",
  manualAllocations: [],
  auditReason: "",
};

describe("supplier payment validation", () => {
  it("normalizes a RON payment without an exchange rate", () => {
    expect(
      supplierPaymentInputSchema.parse({
        ...baseInput,
        currency: "RON",
        originalAmountPaid: "125,50",
        paymentExchangeRate: "",
      }),
    ).toEqual({
      ...baseInput,
      currency: "RON",
      originalAmountPaid: "125.50",
      paymentExchangeRate: null,
      notes: "Supplier payment",
      auditReason: null,
    });
  });

  it("accepts a USD payment-day exchange rate", () => {
    const result = supplierPaymentInputSchema.parse({
      ...baseInput,
      currency: "USD",
      originalAmountPaid: "100",
      paymentExchangeRate: "4,80",
    });

    expect(result.originalAmountPaid).toBe("100.00");
    expect(result.paymentExchangeRate).toBe("4.8");
  });

  it.each([
    { currency: "USD", paymentExchangeRate: "" },
    { currency: "RON", paymentExchangeRate: "4.50" },
    { currency: "EUR", paymentExchangeRate: "" },
    { currency: "USD", paymentExchangeRate: "0" },
  ])("rejects invalid currency and rate combinations", (values) => {
    expect(
      supplierPaymentInputSchema.safeParse({
        ...baseInput,
        ...values,
        originalAmountPaid: "10.00",
      }).success,
    ).toBe(false);
  });

  it("requires manual allocations only for manual strategy", () => {
    expect(
      supplierPaymentInputSchema.safeParse({
        ...baseInput,
        currency: "RON",
        originalAmountPaid: "10.00",
        paymentExchangeRate: "",
        allocationStrategy: "manual",
      }).success,
    ).toBe(false);
    expect(
      supplierPaymentInputSchema.safeParse({
        ...baseInput,
        currency: "RON",
        originalAmountPaid: "10.00",
        paymentExchangeRate: "",
        allocationStrategy: "manual",
        manualAllocations: [
          {
            purchaseId: "70000000-0000-4000-8000-000000000001",
            amountOriginal: "10.00",
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("requires explicit reversal confirmation and reason", () => {
    expect(
      supplierPaymentReversalSchema.safeParse({
        paymentId: "80000000-0000-4000-8000-000000000001",
        supplierId: baseInput.supplierId,
        reason: "short",
      }).success,
    ).toBe(false);
    expect(
      supplierPaymentReversalSchema.safeParse({
        paymentId: "80000000-0000-4000-8000-000000000001",
        supplierId: baseInput.supplierId,
        reason: "Incorrect payment amount entered",
        confirmation: "confirm",
      }).success,
    ).toBe(true);
  });
});
