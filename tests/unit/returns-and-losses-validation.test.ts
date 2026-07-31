import { describe, expect, it } from "vitest";

import {
  inventoryExceptionInputSchema,
  inventoryExceptionReversalSchema,
  saleReturnInputSchema,
  saleReturnReversalSchema,
} from "@/lib/validation/returns-and-losses";

const returnInput = {
  businessDayId: "40000000-0000-4000-8000-000000000001",
  saleId: "41000000-0000-4000-8000-000000000001",
  cashRefundRon: "5",
  bankRefundRon: "3,00",
  creditReductionRon: "10.00",
  idempotencyKey: "42000000-0000-4000-8000-000000000001",
  lines: [
    {
      saleLineId: "43000000-0000-4000-8000-000000000001",
      quantity: "1",
      disposition: "sellable",
    },
    {
      saleLineId: "43000000-0000-4000-8000-000000000002",
      quantity: "2",
      disposition: "damaged",
    },
  ],
  reason: " Customer returned damaged package ",
};

describe("returns and losses validation", () => {
  it("normalizes a mixed-method sale return", () => {
    expect(saleReturnInputSchema.parse(returnInput)).toEqual({
      ...returnInput,
      cashRefundRon: "5.00",
      bankRefundRon: "3.00",
      reason: "Customer returned damaged package",
    });
  });

  it("rejects a return without a refund or credit reduction", () => {
    expect(
      saleReturnInputSchema.safeParse({
        ...returnInput,
        cashRefundRon: "0",
        bankRefundRon: "0",
        creditReductionRon: "0",
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate sale lines, fractional pieces, and bad disposition", () => {
    expect(
      saleReturnInputSchema.safeParse({
        ...returnInput,
        lines: [returnInput.lines[0], returnInput.lines[0]],
      }).success,
    ).toBe(false);
    expect(
      saleReturnInputSchema.safeParse({
        ...returnInput,
        lines: [{ ...returnInput.lines[0], quantity: "1.5" }],
      }).success,
    ).toBe(false);
    expect(
      saleReturnInputSchema.safeParse({
        ...returnInput,
        lines: [{ ...returnInput.lines[0], disposition: "warehouse" }],
      }).success,
    ).toBe(false);
  });

  it("returns field errors instead of throwing for malformed money", () => {
    expect(() =>
      saleReturnInputSchema.safeParse({
        ...returnInput,
        cashRefundRon: "invalid",
      }),
    ).not.toThrow();
  });

  it.each(["damage", "missing", "stolen"])(
    "accepts reasoned %s stock",
    (exceptionType) => {
      expect(
        inventoryExceptionInputSchema.safeParse({
          businessDayId: returnInput.businessDayId,
          productId: "44000000-0000-4000-8000-000000000001",
          sourceLocationId: "45000000-0000-4000-8000-000000000001",
          exceptionType,
          quantity: "2",
          idempotencyKey: returnInput.idempotencyKey,
          reason: "Physical count verified this exception",
        }).success,
      ).toBe(true);
    },
  );

  it("rejects invalid inventory quantity and short reason", () => {
    expect(
      inventoryExceptionInputSchema.safeParse({
        businessDayId: returnInput.businessDayId,
        productId: "44000000-0000-4000-8000-000000000001",
        sourceLocationId: "45000000-0000-4000-8000-000000000001",
        exceptionType: "missing",
        quantity: "0",
        idempotencyKey: returnInput.idempotencyKey,
        reason: "short",
      }).success,
    ).toBe(false);
  });

  it("requires explicit confirmation for both reversal types", () => {
    expect(
      saleReturnReversalSchema.safeParse({
        saleReturnId: "46000000-0000-4000-8000-000000000001",
        reason: "Return was entered against wrong sale",
        confirmation: "confirm",
      }).success,
    ).toBe(true);
    expect(
      inventoryExceptionReversalSchema.safeParse({
        inventoryExceptionId: "47000000-0000-4000-8000-000000000001",
        reason: "Exception used the wrong product",
      }).success,
    ).toBe(false);
  });
});
