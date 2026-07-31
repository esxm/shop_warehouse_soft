import { describe, expect, it } from "vitest";

import {
  stockMovementInputSchema,
  stockMovementReversalSchema,
} from "@/lib/validation/stock-movements";

const ids = {
  productId: "33000000-0000-4000-8000-000000000001",
  sourceLocationId: "33000000-0000-4000-8000-000000000002",
  destinationLocationId: "33000000-0000-4000-8000-000000000003",
  businessDayId: "33000000-0000-4000-8000-000000000004",
  idempotencyKey: "33000000-0000-4000-8000-000000000005",
  referenceId: "33000000-0000-4000-8000-000000000006",
  movementId: "33000000-0000-4000-8000-000000000007",
};

function movement(overrides: Record<string, unknown> = {}) {
  return {
    ...ids,
    entryType: "transfer",
    quantity: "4",
    unitCost: "",
    unitCostCurrency: "RON",
    exchangeRate: "",
    notes: "  Move pieces to shop  ",
    allowNegative: false,
    overrideReason: "",
    ...overrides,
  };
}

describe("product stock movement validation", () => {
  it("normalizes a valid transfer", () => {
    expect(stockMovementInputSchema.parse(movement())).toMatchObject({
      entryType: "transfer",
      quantity: "4",
      unitCost: undefined,
      notes: "Move pieces to shop",
      overrideReason: null,
    });
  });

  it("accepts a transfer in either location direction", () => {
    expect(
      stockMovementInputSchema.safeParse(
        movement({
          sourceLocationId: ids.destinationLocationId,
          destinationLocationId: ids.sourceLocationId,
        }),
      ).success,
    ).toBe(true);
  });

  it.each(["0", "-1", "1.5", "abc"])(
    "rejects non-piece quantity %s",
    (quantity) => {
      expect(
        stockMovementInputSchema.safeParse(movement({ quantity })).success,
      ).toBe(false);
    },
  );

  it.each(["", "0", "0.00", "-1"])(
    "rejects missing or non-positive inbound unit cost %s",
    (unitCost) => {
      expect(
        stockMovementInputSchema.safeParse(
          movement({
            entryType: "opening",
            sourceLocationId: null,
            unitCost,
          }),
        ).success,
      ).toBe(false);
    },
  );

  it("requires two different locations for a transfer", () => {
    expect(
      stockMovementInputSchema.safeParse(
        movement({ destinationLocationId: ids.sourceLocationId }),
      ).success,
    ).toBe(false);
  });

  it("requires only a destination for inbound stock", () => {
    expect(
      stockMovementInputSchema.safeParse(
        movement({
          entryType: "return",
          sourceLocationId: "",
          unitCost: "12.50",
          exchangeRate: "4.50",
        }),
      ).success,
    ).toBe(true);
    expect(
      stockMovementInputSchema.safeParse(
        movement({
          entryType: "return",
          destinationLocationId: "",
          unitCost: "12.50",
          exchangeRate: "4.50",
        }),
      ).success,
    ).toBe(false);
  });

  it.each(["opening", "adjustment_in"])(
    "accepts a missing disabled source field for %s stock",
    (entryType) => {
      expect(
        stockMovementInputSchema.parse(
          movement({
            entryType,
            sourceLocationId: null,
            unitCost: "12.50",
            exchangeRate: "4.50",
          }),
        ).sourceLocationId,
      ).toBeNull();
    },
  );

  it("requires an exchange rate for inbound stock", () => {
    expect(
      stockMovementInputSchema.safeParse(
        movement({
          entryType: "opening",
          sourceLocationId: null,
          unitCost: "1.00",
          unitCostCurrency: "RON",
          exchangeRate: "4.61",
        }),
      ).success,
    ).toBe(true);
    expect(
      stockMovementInputSchema.safeParse(
        movement({
          entryType: "opening",
          sourceLocationId: null,
          unitCost: "1.00",
          unitCostCurrency: "RON",
          exchangeRate: "",
        }),
      ).success,
    ).toBe(false);
  });

  it("requires only a source for outbound stock", () => {
    expect(
      stockMovementInputSchema.safeParse(
        movement({
          entryType: "damage",
          destinationLocationId: null,
        }),
      ).success,
    ).toBe(true);
  });

  it("requires a documented negative-stock override", () => {
    expect(
      stockMovementInputSchema.safeParse(
        movement({
          allowNegative: true,
          overrideReason: "",
        }),
      ).success,
    ).toBe(false);
    expect(
      stockMovementInputSchema.safeParse(
        movement({
          allowNegative: true,
          overrideReason: "Physical count confirms missing stock",
        }),
      ).success,
    ).toBe(true);
  });

  it("requires reversal reason, idempotency key, and confirmation", () => {
    expect(
      stockMovementReversalSchema.safeParse({
        movementId: ids.movementId,
        idempotencyKey: ids.idempotencyKey,
        reason: "Original movement was entered twice",
        allowNegative: false,
        confirmation: "confirm",
      }).success,
    ).toBe(true);
    expect(
      stockMovementReversalSchema.safeParse({
        movementId: ids.movementId,
        reason: "wrong",
      }).success,
    ).toBe(false);
  });
});
