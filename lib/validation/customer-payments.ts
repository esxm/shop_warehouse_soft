import { z } from "zod";

import { positiveMoneyInputSchema } from "@/lib/validation/money";
import {
  reversalConfirmationSchema,
  reversalReasonSchema,
} from "@/lib/validation/reversals";

const nullableTrimmedText = (maximum: number, message: string) =>
  z
    .string()
    .trim()
    .max(maximum, message)
    .transform((value) => value || null);

const manualAllocationSchema = z.object({
  purchaseId: z.uuid("Allocated purchase is invalid."),
  amountRon: positiveMoneyInputSchema,
});

export const customerPaymentInputSchema = z
  .object({
    customerId: z.uuid("Customer is invalid."),
    businessDayId: z.uuid("Business day is invalid."),
    amountRon: positiveMoneyInputSchema,
    financialAccountId: z.uuid("Financial account is invalid."),
    idempotencyKey: z.uuid("Payment request identifier is invalid."),
    notes: nullableTrimmedText(
      500,
      "Payment notes must not exceed 500 characters.",
    ),
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

export const customerPaymentReversalSchema = z.object({
  paymentId: z.uuid("Customer payment is invalid."),
  customerId: z.uuid("Customer is invalid."),
  reason: reversalReasonSchema,
  confirmation: reversalConfirmationSchema(
    "Confirm that this payment should be reversed.",
  ),
});

export type CustomerPaymentInput = z.output<typeof customerPaymentInputSchema>;

export function parseManualAllocations(
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
