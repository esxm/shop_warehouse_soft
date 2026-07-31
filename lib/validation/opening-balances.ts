import { z } from "zod";

import { parseBusinessDate } from "@/lib/date/business-date";
import {
  exchangeRateInputSchema,
  nonNegativeMoneyInputSchema,
  positiveMoneyInputSchema,
} from "@/lib/validation/money";

const partyNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .max(120, "Name must not exceed 120 characters.");

const customerReceivableSchema = z.object({
  name: partyNameSchema,
  amountRon: positiveMoneyInputSchema,
});

const supplierPayableSchema = z
  .object({
    name: partyNameSchema,
    currency: z.enum(["RON", "USD"]),
    originalAmount: positiveMoneyInputSchema,
    purchaseExchangeRate: z.string().optional(),
  })
  .superRefine((payable, context) => {
    if (payable.currency === "USD") {
      const result = exchangeRateInputSchema.safeParse(
        payable.purchaseExchangeRate,
      );

      if (!result.success) {
        context.addIssue({
          code: "custom",
          message: "USD payables require a positive historical exchange rate.",
          path: ["purchaseExchangeRate"],
        });
      }
    } else if (payable.purchaseExchangeRate?.trim()) {
      context.addIssue({
        code: "custom",
        message: "RON payables must not include an exchange rate.",
        path: ["purchaseExchangeRate"],
      });
    }
  })
  .transform((payable) => ({
    name: payable.name,
    currency: payable.currency,
    originalAmount: payable.originalAmount,
    purchaseExchangeRate:
      payable.currency === "USD"
        ? exchangeRateInputSchema.parse(payable.purchaseExchangeRate)
        : undefined,
  }));

export const openingBalanceSchema = z.object({
  openingDate: z.string().transform((input, context) => {
    try {
      return parseBusinessDate(input);
    } catch {
      context.addIssue({
        code: "custom",
        message: "Enter a valid opening date.",
      });
      return z.NEVER;
    }
  }),
  cashBalanceRon: nonNegativeMoneyInputSchema,
  bankBalanceRon: nonNegativeMoneyInputSchema,
  warehouseInventoryRon: nonNegativeMoneyInputSchema,
  shopInventoryRon: nonNegativeMoneyInputSchema,
  customerReceivables: z
    .array(customerReceivableSchema)
    .max(100, "At most 100 customer receivables can be initialized."),
  supplierPayables: z
    .array(supplierPayableSchema)
    .max(100, "At most 100 supplier payables can be initialized."),
});

export type OpeningBalanceInput = z.output<typeof openingBalanceSchema>;

export const openingBalanceReversalSchema = z.object({
  batchId: z.uuid("Opening batch is invalid."),
  reason: z
    .string()
    .trim()
    .min(10, "Explain the correction in at least 10 characters.")
    .max(500, "Reason must not exceed 500 characters."),
  confirmation: z.literal("confirm", {
    error: "Confirm that you understand the reversal is permanent.",
  }),
});

export function parseOpeningBalanceList(input: FormDataEntryValue | null) {
  if (typeof input !== "string") {
    return null;
  }

  try {
    return JSON.parse(input) as unknown;
  } catch {
    return null;
  }
}
