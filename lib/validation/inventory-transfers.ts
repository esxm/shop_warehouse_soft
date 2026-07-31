import { z } from "zod";

import {
  reversalConfirmationSchema,
  reversalReasonSchema,
} from "@/lib/validation/reversals";

export const inventoryTransferLineSchema = z.object({
  productId: z.uuid("Select a valid product."),
  quantity: z
    .string()
    .trim()
    .regex(/^[1-9]\d{0,17}$/, "Quantity must be a positive whole number."),
});

export function parseInventoryTransferLines(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

export const inventoryTransferInputSchema = z
  .object({
    businessDayId: z.uuid("Business day is invalid."),
    sourceLocationId: z.uuid("Source location is invalid."),
    destinationLocationId: z.uuid("Destination location is invalid."),
    lines: z
      .array(inventoryTransferLineSchema, {
        error: "Add valid product lines.",
      })
      .min(1, "Add at least one product.")
      .max(100, "A transfer cannot exceed 100 product lines."),
    notes: z
      .string()
      .trim()
      .max(500, "Notes must not exceed 500 characters.")
      .transform((notes) => notes || null),
    idempotencyKey: z.uuid("Transfer request identifier is invalid."),
    auditReason: z
      .string()
      .trim()
      .max(500, "Audit reason must not exceed 500 characters.")
      .refine(
        (reason) => reason === "" || reason.length >= 10,
        "Audit reason must contain at least 10 characters.",
      )
      .transform((reason) => reason || null),
  })
  .superRefine((input, context) => {
    if (input.sourceLocationId === input.destinationLocationId) {
      context.addIssue({
        code: "custom",
        message: "Source and destination must differ.",
        path: ["destinationLocationId"],
      });
    }

    const productIds = new Set<string>();
    for (const line of input.lines) {
      if (productIds.has(line.productId)) {
        context.addIssue({
          code: "custom",
          message: "Each product may appear only once.",
          path: ["lines"],
        });
      }
      productIds.add(line.productId);
    }
  });

export const inventoryTransferReversalSchema = z.object({
  transferId: z.uuid("Inventory transfer is invalid."),
  reason: reversalReasonSchema,
  allowNegativeStock: z.boolean(),
  confirmation: reversalConfirmationSchema(
    "Confirm that this inventory transfer should be reversed.",
  ),
});

export type InventoryTransferInput = z.output<
  typeof inventoryTransferInputSchema
>;
