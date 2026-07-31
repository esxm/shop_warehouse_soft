import { z } from "zod";

import { parseBusinessDate } from "@/lib/date/business-date";
import { nonNegativeMoneyInputSchema } from "@/lib/validation/money";

const stocktakeDateSchema = z.string().transform((input, context) => {
  try {
    return parseBusinessDate(input);
  } catch {
    context.addIssue({
      code: "custom",
      message: "Enter a valid stocktake date.",
    });
    return z.NEVER;
  }
});

export const inventoryStocktakeInputSchema = z.object({
  stocktakeDate: stocktakeDateSchema,
  warehouseActualValueRon: nonNegativeMoneyInputSchema,
  shopActualValueRon: nonNegativeMoneyInputSchema,
  reason: z
    .string()
    .trim()
    .min(10, "Explain the stocktake in at least 10 characters.")
    .max(500, "Reason must not exceed 500 characters."),
  notes: z
    .string()
    .trim()
    .max(500, "Notes must not exceed 500 characters.")
    .transform((notes) => notes || null),
  idempotencyKey: z.uuid("Stocktake request identifier is invalid."),
});

export const inventoryStocktakeReversalSchema = z.object({
  stocktakeId: z.uuid("Inventory stocktake is invalid."),
  reason: z
    .string()
    .trim()
    .min(10, "Explain the reversal in at least 10 characters.")
    .max(500, "Reason must not exceed 500 characters."),
  confirmation: z.literal("confirm", {
    error: "Confirm that this inventory stocktake should be reversed.",
  }),
});

export type InventoryStocktakeInput = z.output<
  typeof inventoryStocktakeInputSchema
>;
