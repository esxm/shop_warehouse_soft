import { describe, expect, it } from "vitest";

import {
  customerPaymentInputSchema,
  customerPaymentReversalSchema,
  parseManualAllocations,
} from "@/lib/validation/customer-payments";

const customerId = "30000000-0000-4000-8000-000000000001";
const businessDayId = "40000000-0000-4000-8000-000000000001";
const accountId = "50000000-0000-4000-8000-000000000001";
const purchaseId = "60000000-0000-4000-8000-000000000001";
const paymentId = "70000000-0000-4000-8000-000000000001";
const idempotencyKey = "80000000-0000-4000-8000-000000000001";

const baseInput = {
  customerId,
  businessDayId,
  amountRon: "600,5",
  financialAccountId: accountId,
  idempotencyKey,
  notes: "  Cash payment  ",
  allocationStrategy: "oldest_first",
  manualAllocations: [],
  auditReason: "",
};

describe("customer payment validation", () => {
  it("normalizes an automatic payment as decimal strings", () => {
    expect(customerPaymentInputSchema.parse(baseInput)).toEqual({
      ...baseInput,
      amountRon: "600.50",
      notes: "Cash payment",
      auditReason: null,
    });
  });

  it("accepts administrator manual allocation input", () => {
    const result = customerPaymentInputSchema.parse({
      ...baseInput,
      amountRon: "50",
      allocationStrategy: "manual",
      manualAllocations: [{ purchaseId, amountRon: "50.00" }],
    });

    expect(result.amountRon).toBe("50.00");
    expect(result.manualAllocations[0]?.amountRon).toBe("50.00");
  });

  it("rejects inconsistent allocation modes", () => {
    expect(
      customerPaymentInputSchema.safeParse({
        ...baseInput,
        allocationStrategy: "manual",
      }).success,
    ).toBe(false);
    expect(
      customerPaymentInputSchema.safeParse({
        ...baseInput,
        manualAllocations: [{ purchaseId, amountRon: "10" }],
      }).success,
    ).toBe(false);
  });

  it.each(["0", "-1", "1.234"])(
    "rejects invalid payment amount %s",
    (amountRon) => {
      expect(
        customerPaymentInputSchema.safeParse({
          ...baseInput,
          amountRon,
        }).success,
      ).toBe(false);
    },
  );

  it("parses manual allocation JSON without trusting malformed input", () => {
    expect(
      parseManualAllocations(
        JSON.stringify([{ purchaseId, amountRon: "25.00" }]),
      ),
    ).toEqual([{ purchaseId, amountRon: "25.00" }]);
    expect(parseManualAllocations("{broken")).toBeNull();
    expect(parseManualAllocations(null)).toBeNull();
  });

  it("requires a reason and confirmation for reversal", () => {
    expect(
      customerPaymentReversalSchema.safeParse({
        customerId,
        paymentId,
        reason: "short",
        confirmation: undefined,
      }).success,
    ).toBe(false);
    expect(
      customerPaymentReversalSchema.safeParse({
        customerId,
        paymentId,
        reason: "Correcting an incorrectly recorded payment",
        confirmation: "confirm",
      }).success,
    ).toBe(true);
  });
});
