import { describe, expect, it } from "vitest";

import {
  expenseInputSchema,
  expenseReversalSchema,
} from "@/lib/validation/expenses";

const ids = {
  businessDayId: "15000000-0000-4000-8000-000000000001",
  categoryId: "15000000-0000-4000-8000-000000000002",
  financialAccountId: "15000000-0000-4000-8000-000000000003",
  idempotencyKey: "15000000-0000-4000-8000-000000000004",
  expenseId: "15000000-0000-4000-8000-000000000005",
};

describe("expense validation", () => {
  it("normalizes a valid expense", () => {
    expect(
      expenseInputSchema.parse({
        ...ids,
        amountRon: "25,50",
        description: "  Electricity invoice  ",
        auditReason: "",
      }),
    ).toEqual({
      businessDayId: ids.businessDayId,
      categoryId: ids.categoryId,
      financialAccountId: ids.financialAccountId,
      idempotencyKey: ids.idempotencyKey,
      amountRon: "25.50",
      description: "Electricity invoice",
      auditReason: null,
    });
  });

  it.each(["0", "-1", "1.234", "abc"])(
    "rejects invalid expense amount %s",
    (amountRon) => {
      expect(
        expenseInputSchema.safeParse({
          ...ids,
          amountRon,
          description: "Transport",
          auditReason: "",
        }).success,
      ).toBe(false);
    },
  );

  it("rejects a short nonempty audit reason", () => {
    expect(
      expenseInputSchema.safeParse({
        ...ids,
        amountRon: "10",
        description: "Transport",
        auditReason: "too short",
      }).success,
    ).toBe(false);
  });

  it("requires a reason and confirmation for reversal", () => {
    expect(
      expenseReversalSchema.safeParse({
        expenseId: ids.expenseId,
        reason: "Entered against the wrong account",
        confirmation: "confirm",
      }).success,
    ).toBe(true);
    expect(
      expenseReversalSchema.safeParse({
        expenseId: ids.expenseId,
        reason: "wrong",
      }).success,
    ).toBe(false);
  });
});
