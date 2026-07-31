import { z } from "zod";

import { addMoney } from "@/lib/money/money";
import { nonNegativeMoneyInputSchema } from "@/lib/validation/money";
import {
  reversalConfirmationSchema,
  reversalReasonSchema,
} from "@/lib/validation/reversals";

export const saleReturnLineSchema = z.object({
  saleLineId: z.uuid("Original sale line is invalid."),
  quantity: z
    .string()
    .trim()
    .regex(
      /^[1-9]\d{0,17}$/,
      "Return quantity must be a positive whole number.",
    ),
  disposition: z.enum(["sellable", "damaged"], {
    error: "Choose whether returned stock is sellable or damaged.",
  }),
});

export function parseSaleReturnLines(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

export const saleReturnInputSchema = z
  .object({
    businessDayId: z.uuid("Business day is invalid."),
    saleId: z.uuid("Original sale is invalid."),
    cashRefundRon: nonNegativeMoneyInputSchema,
    bankRefundRon: nonNegativeMoneyInputSchema,
    creditReductionRon: nonNegativeMoneyInputSchema,
    idempotencyKey: z.uuid("Return request identifier is invalid."),
    lines: z
      .array(saleReturnLineSchema, { error: "Add valid return lines." })
      .min(1, "Return at least one product.")
      .max(100, "A return cannot exceed 100 product lines."),
    reason: z
      .string()
      .trim()
      .min(10, "Return reason must contain at least 10 characters.")
      .max(500, "Return reason must not exceed 500 characters."),
  })
  .superRefine((input, context) => {
    const lineIds = new Set<string>();
    for (const line of input.lines) {
      if (lineIds.has(line.saleLineId)) {
        context.addIssue({
          code: "custom",
          message: "Each original sale line may appear only once.",
          path: ["lines"],
        });
      }
      lineIds.add(line.saleLineId);
    }

    const refundAmounts = [
      input.cashRefundRon,
      input.bankRefundRon,
      input.creditReductionRon,
    ];
    if (
      refundAmounts.every((amount) => /^\d+\.\d{2}$/.test(amount)) &&
      addMoney(...refundAmounts) === "0.00"
    ) {
      context.addIssue({
        code: "custom",
        message: "Enter a cash refund, bank refund, or credit reduction.",
        path: ["cashRefundRon"],
      });
    }
  });

export const inventoryExceptionInputSchema = z.object({
  businessDayId: z.uuid("Business day is invalid."),
  productId: z.uuid("Product is invalid."),
  sourceLocationId: z.uuid("Source location is invalid."),
  exceptionType: z.enum(["damage", "missing", "stolen"], {
    error: "Inventory exception type is invalid.",
  }),
  quantity: z
    .string()
    .trim()
    .regex(/^[1-9]\d{0,17}$/, "Quantity must be a positive whole number."),
  idempotencyKey: z.uuid("Exception request identifier is invalid."),
  reason: z
    .string()
    .trim()
    .min(10, "Reason must contain at least 10 characters.")
    .max(500, "Reason must not exceed 500 characters."),
});

export const saleReturnReversalSchema = z.object({
  saleReturnId: z.uuid("Sale return is invalid."),
  reason: reversalReasonSchema,
  confirmation: reversalConfirmationSchema(
    "Confirm that this sale return should be reversed.",
  ),
});

export const inventoryExceptionReversalSchema = z.object({
  inventoryExceptionId: z.uuid("Inventory exception is invalid."),
  reason: reversalReasonSchema,
  confirmation: reversalConfirmationSchema(
    "Confirm that this inventory exception should be reversed.",
  ),
});

export type SaleReturnInput = z.output<typeof saleReturnInputSchema>;
export type InventoryExceptionInput = z.output<
  typeof inventoryExceptionInputSchema
>;
