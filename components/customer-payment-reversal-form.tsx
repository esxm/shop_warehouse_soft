"use client";

import { useActionState } from "react";

import {
  reverseCustomerPaymentAction,
  type CustomerActionState,
} from "@/app/(protected)/customers/actions";
import { ReversalForm } from "@/components/reversal-form";

const initialState: CustomerActionState = {};

export function CustomerPaymentReversalForm({
  customerId,
  paymentId,
}: Readonly<{ customerId: string; paymentId: string }>) {
  const [state, formAction, pending] = useActionState(
    reverseCustomerPaymentAction,
    initialState,
  );

  return (
    <ReversalForm
      action={formAction}
      confirmationLabel="Reverse the allocations and account inflow while preserving history."
      hiddenFields={[
        { name: "customerId", value: customerId },
        { name: "paymentId", value: paymentId },
      ]}
      id={`payment-reversal-reason-${paymentId}`}
      pending={pending}
      reasonLabel="Payment reversal reason"
      state={state}
      submitLabel="Reverse payment"
    />
  );
}
