"use client";

import { useActionState } from "react";

import {
  reverseSupplierPaymentAction,
  type SupplierActionState,
} from "@/app/(protected)/suppliers/actions";
import { ReversalForm } from "@/components/reversal-form";

const initialState: SupplierActionState = {};

export function SupplierPaymentReversalForm({
  supplierId,
  paymentId,
}: Readonly<{ supplierId: string; paymentId: string }>) {
  const [state, formAction, pending] = useActionState(
    reverseSupplierPaymentAction,
    initialState,
  );

  return (
    <ReversalForm
      action={formAction}
      confirmationLabel="Restore the payable and account balance while preserving payment and allocation history."
      hiddenFields={[
        { name: "supplierId", value: supplierId },
        { name: "paymentId", value: paymentId },
      ]}
      id={`supplier-payment-reversal-${paymentId}`}
      pending={pending}
      reasonLabel="Payment reversal reason"
      state={state}
      submitLabel="Reverse supplier payment"
    />
  );
}
