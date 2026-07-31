"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin, requireBusinessMember } from "@/lib/auth/session";
import {
  expenseInputSchema,
  expenseReversalSchema,
} from "@/lib/validation/expenses";
import { createExpense, reverseExpense } from "@/services/expenses";

export type ExpenseActionState = Readonly<{
  message?: string;
  errors?: Partial<
    Record<
      | "businessDayId"
      | "categoryId"
      | "amountRon"
      | "financialAccountId"
      | "description"
      | "idempotencyKey"
      | "auditReason"
      | "expenseId"
      | "reason"
      | "confirmation",
      string[]
    >
  >;
}>;

export async function createExpenseAction(
  _previousState: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const context = await requireBusinessMember();
  const result = expenseInputSchema.safeParse({
    businessDayId: formData.get("businessDayId"),
    categoryId: formData.get("categoryId"),
    amountRon: formData.get("amountRon"),
    financialAccountId: formData.get("financialAccountId"),
    description: formData.get("description"),
    idempotencyKey: formData.get("idempotencyKey"),
    auditReason: formData.get("auditReason"),
  });

  if (!result.success) {
    return {
      message: result.error.issues[0]?.message ?? "Check the expense.",
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    await createExpense(context, result.data);
  } catch (error) {
    return {
      message:
        error instanceof Error ? error.message : "Expense could not be saved.",
    };
  }

  revalidatePath("/expenses");
  revalidatePath("/cash-and-bank");
  redirect("/expenses?created=1");
}

export async function reverseExpenseAction(
  _previousState: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const context = await requireAdmin();
  const result = expenseReversalSchema.safeParse({
    expenseId: formData.get("expenseId"),
    reason: formData.get("reason"),
    confirmation: formData.get("confirmation"),
  });

  if (!result.success) {
    return {
      message: result.error.issues[0]?.message ?? "Check the reversal.",
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    await reverseExpense(context, result.data.expenseId, result.data.reason);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Expense could not be reversed.",
    };
  }

  revalidatePath("/expenses");
  revalidatePath("/cash-and-bank");
  redirect("/expenses?reversed=1");
}
