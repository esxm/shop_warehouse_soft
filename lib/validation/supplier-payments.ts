import { z } from "zod";

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

const nullableExchangeRateSchema = z
  .string()
  .trim()
  .transform((input, context): ExchangeRate | null => {
    if (!input) {
      return null;
    }

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

const manualAllocationSchema = z.object({
  purchaseId: z.uuid("Allocated supplier purchase is invalid."),
  amountOriginal: positiveMoneyInputSchema,
});

export const supplierPaymentInputSchema = z
  .object({
    supplierId: z.uuid("Supplier is invalid."),
    businessDayId: z.uuid("Business day is invalid."),
    currency: z.enum(["RON", "USD"], {
      error: "Currency must be RON or USD.",
    }),
    originalAmountPaid: positiveMoneyInputSchema,
    paymentExchangeRate: nullableExchangeRateSchema,
    financialAccountId: z.uuid("Financial account is invalid."),
    idempotencyKey: z.uuid("Payment request identifier is invalid."),
    notes: z
      .string()
      .trim()
      .max(500, "Payment notes must not exceed 500 characters.")
      .transform((notes) => notes || null),
    allocationStrategy: z.enum(["oldest_first", "manual"]),
    manualAllocations: z
      .array(manualAllocationSchema)
      .max(200, "At most 200 purchases can be allocated manually."),
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
    if (input.currency === "USD" && input.paymentExchangeRate === null) {
      context.addIssue({
        code: "custom",
        message: "Enter the payment-day USD/RON exchange rate.",
        path: ["paymentExchangeRate"],
      });
    }

    if (input.currency === "RON" && input.paymentExchangeRate !== null) {
      context.addIssue({
        code: "custom",
        message: "RON payments do not use an exchange rate.",
        path: ["paymentExchangeRate"],
      });
    }

    if (
      input.allocationStrategy === "manual" &&
      input.manualAllocations.length === 0
    ) {
      context.addIssue({
        code: "custom",
        message: "Enter at least one manual allocation.",
        path: ["manualAllocations"],
      });
    }

    if (
      input.allocationStrategy === "oldest_first" &&
      input.manualAllocations.length > 0
    ) {
      context.addIssue({
        code: "custom",
        message: "Automatic allocation must not include manual amounts.",
        path: ["manualAllocations"],
      });
    }
  });

export const supplierPaymentReversalSchema = z.object({
  paymentId: z.uuid("Supplier payment is invalid."),
  supplierId: z.uuid("Supplier is invalid."),
  reason: reversalReasonSchema,
  confirmation: reversalConfirmationSchema(
    "Confirm that this supplier payment should be reversed.",
  ),
});

export type SupplierPaymentInput = z.output<typeof supplierPaymentInputSchema>;

export function parseSupplierManualAllocations(
  input: FormDataEntryValue | null,
): unknown {
  if (typeof input !== "string") {
    return null;
  }

  try {
    return JSON.parse(input) as unknown;
  } catch {
    return null;
  }
}
