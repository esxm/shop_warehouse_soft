import { z } from "zod";

import { positiveMoneyInputSchema } from "@/lib/validation/money";
import {
  reversalConfirmationSchema,
  reversalReasonSchema,
} from "@/lib/validation/reversals";

export const expenseInputSchema = z.object({
  businessDayId: z.uuid("Business day is invalid."),
  categoryId: z.uuid("Expense category is invalid."),
  amountRon: positiveMoneyInputSchema,
  financialAccountId: z.uuid("Financial account is invalid."),
  description: z
    .string()
    .trim()
    .min(1, "Enter an expense description.")
    .max(500, "Description must not exceed 500 characters."),
  idempotencyKey: z.uuid("Expense request identifier is invalid."),
  auditReason: z
    .string()
    .trim()
    .max(500, "Audit reason must not exceed 500 characters.")
    .refine(
      (reason) => reason === "" || reason.length >= 10,
      "Audit reason must contain at least 10 characters.",
    )
    .transform((reason) => reason || null),
});

export const expenseReversalSchema = z.object({
  expenseId: z.uuid("Expense is invalid."),
  reason: reversalReasonSchema,
  confirmation: reversalConfirmationSchema(
    "Confirm that this expense should be reversed.",
  ),
});

export type ExpenseInput = z.output<typeof expenseInputSchema>;
