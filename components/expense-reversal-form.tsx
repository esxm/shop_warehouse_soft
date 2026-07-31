"use client";

import { useActionState } from "react";

import {
  reverseExpenseAction,
  type ExpenseActionState,
} from "@/app/(protected)/expenses/actions";
import { ReversalForm } from "@/components/reversal-form";

const initialState: ExpenseActionState = {};

export function ExpenseReversalForm({
  expenseId,
}: Readonly<{ expenseId: string }>) {
  const [state, formAction, pending] = useActionState(
    reverseExpenseAction,
    initialState,
  );

  return (
    <ReversalForm
      action={formAction}
      confirmationLabel="Restore the account balance while preserving the original expense."
      hiddenFields={[{ name: "expenseId", value: expenseId }]}
      id={`expense-reversal-${expenseId}`}
      pending={pending}
      reasonLabel="Reversal reason"
      state={state}
      submitLabel="Reverse expense"
    />
  );
}
