import { z } from "zod";

import { parseBusinessDate } from "@/lib/date/business-date";
import {
  MoneyInputError,
  parseExchangeRate,
  type ExchangeRate,
} from "@/lib/money/money";
import { positiveMoneyInputSchema } from "@/lib/validation/money";
import {
  reversalConfirmationSchema,
  reversalReasonSchema,
} from "@/lib/validation/reversals";

export const customerCreditPurchaseLineSchema = z.object({
  productId: z.uuid("Select a valid product."),
  quantity: z
    .string()
    .trim()
    .regex(/^[1-9]\d{0,17}$/, "Quantity must be a positive whole number."),
  unitSellingPriceOriginalCurrency: positiveMoneyInputSchema,
});

export function parseCustomerCreditPurchaseLines(
  value: FormDataEntryValue | null,
) {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

const nullableBusinessDateSchema = z
  .string()
  .trim()
  .transform((input, context) => {
    if (!input) {
      return null;
    }

    try {
      return parseBusinessDate(input);
    } catch {
      context.addIssue({
        code: "custom",
        message: "Enter a valid due date.",
      });
      return z.NEVER;
    }
  });

const exchangeRateSchema = z
  .string()
  .trim()
  .transform((input, context): ExchangeRate => {
    try {
      return parseExchangeRate(input);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message:
          error instanceof MoneyInputError
            ? error.message
            : "Enter a valid exchange rate.",
      });
      return z.NEVER;
    }
  });

export const customerCreditPurchaseInputSchema = z
  .object({
    customerId: z.uuid("Customer is invalid."),
    businessDayId: z.uuid("Business day is invalid."),
    shopLocationId: z.uuid("Shop location is invalid."),
    idempotencyKey: z.uuid("Purchase request identifier is invalid."),
    currency: z.enum(["RON", "USD"], {
      error: "Currency must be RON or USD.",
    }),
    exchangeRate: exchangeRateSchema,
    lines: z
      .array(customerCreditPurchaseLineSchema, {
        error: "Add valid product lines.",
      })
      .min(1, "Add at least one product.")
      .max(100, "A credit purchase cannot exceed 100 product lines."),
    description: z
      .string()
      .trim()
      .max(500, "Description must not exceed 500 characters.")
      .transform((description) => description || null),
    dueDate: nullableBusinessDateSchema,
    auditReason: z
      .string()
      .trim()
      .max(500, "Audit reason must not exceed 500 characters.")
      .transform((reason) => reason || null),
  })
  .superRefine((input, context) => {
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

export const customerCreditPurchaseReversalSchema = z.object({
  purchaseId: z.uuid("Credit purchase is invalid."),
  customerId: z.uuid("Customer is invalid."),
  reason: reversalReasonSchema,
  confirmation: reversalConfirmationSchema(
    "Confirm that this purchase should be reversed.",
  ),
});

export type CustomerCreditPurchaseInput = z.output<
  typeof customerCreditPurchaseInputSchema
>;
