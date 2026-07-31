import { z } from "zod";

export const stockThresholdInputSchema = z.object({
  productId: z.uuid("Product is invalid."),
  inventoryLocationId: z.uuid("Inventory location is invalid."),
  minimumQuantity: z
    .string()
    .trim()
    .regex(
      /^(0|[1-9]\d{0,17})$/,
      "Minimum quantity must be a non-negative whole number.",
    ),
});

export type StockThresholdInput = z.output<typeof stockThresholdInputSchema>;
