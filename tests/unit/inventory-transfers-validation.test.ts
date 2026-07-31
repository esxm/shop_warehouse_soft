import { describe, expect, it } from "vitest";

import {
  inventoryTransferInputSchema,
  inventoryTransferReversalSchema,
} from "@/lib/validation/inventory-transfers";

const ids = {
  businessDayId: "16000000-0000-4000-8000-000000000001",
  sourceLocationId: "16000000-0000-4000-8000-000000000002",
  destinationLocationId: "16000000-0000-4000-8000-000000000003",
  idempotencyKey: "16000000-0000-4000-8000-000000000004",
  transferId: "16000000-0000-4000-8000-000000000005",
  productId: "16000000-0000-4000-8000-000000000006",
};

describe("inventory transfer validation", () => {
  it("normalizes a valid transfer", () => {
    expect(
      inventoryTransferInputSchema.parse({
        ...ids,
        lines: [{ productId: ids.productId, quantity: "3" }],
        notes: "  Move value to shop  ",
        auditReason: "",
      }),
    ).toEqual({
      businessDayId: ids.businessDayId,
      sourceLocationId: ids.sourceLocationId,
      destinationLocationId: ids.destinationLocationId,
      idempotencyKey: ids.idempotencyKey,
      lines: [{ productId: ids.productId, quantity: "3" }],
      notes: "Move value to shop",
      auditReason: null,
    });
  });

  it.each(["0", "-1", "1.5", "abc"])(
    "rejects invalid transfer quantity %s",
    (quantity) => {
      expect(
        inventoryTransferInputSchema.safeParse({
          ...ids,
          lines: [{ productId: ids.productId, quantity }],
          notes: "",
          auditReason: "",
        }).success,
      ).toBe(false);
    },
  );

  it("rejects matching source and destination locations", () => {
    expect(
      inventoryTransferInputSchema.safeParse({
        ...ids,
        destinationLocationId: ids.sourceLocationId,
        lines: [{ productId: ids.productId, quantity: "1" }],
        notes: "",
        auditReason: "",
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate products", () => {
    expect(
      inventoryTransferInputSchema.safeParse({
        ...ids,
        lines: [
          { productId: ids.productId, quantity: "1" },
          { productId: ids.productId, quantity: "2" },
        ],
        notes: "",
        auditReason: "",
      }).success,
    ).toBe(false);
  });

  it("requires a reason and confirmation for reversal", () => {
    expect(
      inventoryTransferReversalSchema.safeParse({
        transferId: ids.transferId,
        reason: "Transfer was entered twice",
        allowNegativeStock: false,
        confirmation: "confirm",
      }).success,
    ).toBe(true);
    expect(
      inventoryTransferReversalSchema.safeParse({
        transferId: ids.transferId,
        reason: "wrong",
      }).success,
    ).toBe(false);
  });
});
