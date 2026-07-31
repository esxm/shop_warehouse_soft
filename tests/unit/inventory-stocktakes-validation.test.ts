import { describe, expect, it } from "vitest";

import {
  inventoryStocktakeInputSchema,
  inventoryStocktakeReversalSchema,
} from "@/lib/validation/inventory-stocktakes";

const idempotencyKey = "17000000-0000-4000-8000-000000000001";
const stocktakeId = "17000000-0000-4000-8000-000000000002";

describe("inventory stocktake validation", () => {
  it("normalizes a valid stocktake", () => {
    expect(
      inventoryStocktakeInputSchema.parse({
        stocktakeDate: "2026-07-01",
        warehouseActualValueRon: "90,50",
        shopActualValueRon: "0",
        reason: "  Completed physical inventory count  ",
        notes: "  Counted after closing  ",
        idempotencyKey,
      }),
    ).toEqual({
      stocktakeDate: "2026-07-01",
      warehouseActualValueRon: "90.50",
      shopActualValueRon: "0.00",
      reason: "Completed physical inventory count",
      notes: "Counted after closing",
      idempotencyKey,
    });
  });

  it.each(["-1", "1.234", "abc"])(
    "rejects invalid actual value %s",
    (warehouseActualValueRon) => {
      expect(
        inventoryStocktakeInputSchema.safeParse({
          stocktakeDate: "2026-07-01",
          warehouseActualValueRon,
          shopActualValueRon: "10",
          reason: "Completed physical inventory count",
          notes: "",
          idempotencyKey,
        }).success,
      ).toBe(false);
    },
  );

  it("rejects an invalid date", () => {
    expect(
      inventoryStocktakeInputSchema.safeParse({
        stocktakeDate: "2026-02-30",
        warehouseActualValueRon: "10",
        shopActualValueRon: "10",
        reason: "Completed physical inventory count",
        notes: "",
        idempotencyKey,
      }).success,
    ).toBe(false);
  });

  it("requires a meaningful reason", () => {
    expect(
      inventoryStocktakeInputSchema.safeParse({
        stocktakeDate: "2026-07-01",
        warehouseActualValueRon: "10",
        shopActualValueRon: "10",
        reason: "counted",
        notes: "",
        idempotencyKey,
      }).success,
    ).toBe(false);
  });

  it("requires a reason and confirmation for reversal", () => {
    expect(
      inventoryStocktakeReversalSchema.safeParse({
        stocktakeId,
        reason: "Count was entered incorrectly",
        confirmation: "confirm",
      }).success,
    ).toBe(true);
    expect(
      inventoryStocktakeReversalSchema.safeParse({
        stocktakeId,
        reason: "wrong",
      }).success,
    ).toBe(false);
  });
});
