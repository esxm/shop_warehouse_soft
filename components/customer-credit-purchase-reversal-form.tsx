"use client";

import { useActionState } from "react";

import {
  reverseCustomerCreditPurchaseAction,
  type CustomerActionState,
} from "@/app/(protected)/customers/actions";
import { ReversalForm } from "@/components/reversal-form";

const initialState: CustomerActionState = {};

export function CustomerCreditPurchaseReversalForm({
  customerId,
  purchaseId,
}: Readonly<{ customerId: string; purchaseId: string }>) {
  const [state, formAction, pending] = useActionState(
    reverseCustomerCreditPurchaseAction,
    initialState,
  );

  return (
    <ReversalForm
      action={formAction}
      confirmationLabel="I understand the original purchase remains visible as reversed."
      hiddenFields={[
        { name: "customerId", value: customerId },
        { name: "purchaseId", value: purchaseId },
      ]}
      id={`reversal-reason-${purchaseId}`}
      pending={pending}
      reasonLabel="Reversal reason"
      state={state}
      submitLabel="Reverse purchase"
    />
  );
}
