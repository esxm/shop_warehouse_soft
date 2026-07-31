"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin, requireBusinessMember } from "@/lib/auth/session";
import { getOpenBusinessDay } from "@/services/business-days";
import {
  createCustomerCreditPurchase,
  reverseCustomerCreditPurchase,
} from "@/services/customer-credit-purchases";
import {
  customerCreditPurchaseInputSchema,
  customerCreditPurchaseReversalSchema,
  parseCustomerCreditPurchaseLines,
} from "@/lib/validation/customer-credit-purchases";
import {
  customerPaymentInputSchema,
  customerPaymentReversalSchema,
  parseManualAllocations,
} from "@/lib/validation/customer-payments";
import {
  customerDeactivationSchema,
  customerInputSchema,
  customerUpdateSchema,
} from "@/lib/validation/customers";
import {
  createCustomer,
  deactivateCustomer,
  updateCustomer,
} from "@/services/customers";
import {
  createCustomerPayment,
  reverseCustomerPayment,
} from "@/services/customer-payments";

export type CustomerActionState = Readonly<{
  message?: string;
  errors?: {
    name?: string[];
    phone?: string[];
    notes?: string[];
    confirmation?: string[];
    businessDayId?: string[];
    shopLocationId?: string[];
    amountRon?: string[];
    currency?: string[];
    exchangeRate?: string[];
    lines?: string[];
    description?: string[];
    dueDate?: string[];
    auditReason?: string[];
    reason?: string[];
    financialAccountId?: string[];
    idempotencyKey?: string[];
    allocationStrategy?: string[];
    manualAllocations?: string[];
  };
}>;

export async function createCustomerAction(
  _previousState: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const context = await requireBusinessMember();
  const result = customerInputSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    notes: formData.get("notes"),
  });

  if (!result.success) {
    return {
      message: result.error.issues[0]?.message ?? "Check the customer details.",
      errors: result.error.flatten().fieldErrors,
    };
  }

  let customerId: string;

  try {
    customerId = await createCustomer(context, result.data);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Customer could not be created.",
    };
  }

  revalidatePath("/customers");
  redirect(`/customers/${customerId}?created=1`);
}

export async function updateCustomerAction(
  _previousState: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const context = await requireBusinessMember();
  const result = customerUpdateSchema.safeParse({
    customerId: formData.get("customerId"),
    name: formData.get("name"),
    phone: formData.get("phone"),
    notes: formData.get("notes"),
  });

  if (!result.success) {
    return {
      message: result.error.issues[0]?.message ?? "Check the customer details.",
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    await updateCustomer(context, result.data);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Customer could not be updated.",
    };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${result.data.customerId}`);
  redirect(`/customers/${result.data.customerId}?updated=1`);
}

export async function deactivateCustomerAction(
  _previousState: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const context = await requireAdmin();
  const result = customerDeactivationSchema.safeParse({
    customerId: formData.get("customerId"),
    confirmation: formData.get("confirmation"),
  });

  if (!result.success) {
    return {
      message:
        result.error.issues[0]?.message ?? "Confirm customer deactivation.",
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    await deactivateCustomer(context, result.data.customerId);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Customer could not be deactivated.",
    };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${result.data.customerId}`);
  redirect(`/customers/${result.data.customerId}?deactivated=1`);
}

export async function createCustomerCreditPurchaseAction(
  _previousState: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const context = await requireBusinessMember();
  const result = customerCreditPurchaseInputSchema.safeParse({
    customerId: formData.get("customerId"),
    businessDayId: formData.get("businessDayId"),
    shopLocationId: formData.get("shopLocationId"),
    idempotencyKey: formData.get("idempotencyKey"),
    currency: formData.get("currency"),
    exchangeRate: formData.get("exchangeRate"),
    lines: parseCustomerCreditPurchaseLines(formData.get("lines")),
    description: formData.get("description"),
    dueDate: formData.get("dueDate"),
    auditReason: formData.get("auditReason"),
  });

  if (!result.success) {
    return {
      message:
        result.error.issues[0]?.message ?? "Check the credit purchase details.",
      errors: result.error.flatten().fieldErrors,
    };
  }

  if (context.role === "employee") {
    const openDay = await getOpenBusinessDay(context.business.id);

    if (!openDay || openDay.id !== result.data.businessDayId) {
      return {
        message: "Employees must use the current open business day.",
        errors: {
          businessDayId: ["Select the current open business day."],
        },
      };
    }
  }

  try {
    await createCustomerCreditPurchase(context, result.data);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Customer credit purchase could not be created.",
    };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${result.data.customerId}`);
  redirect(`/customers/${result.data.customerId}?purchaseCreated=1`);
}

export async function reverseCustomerCreditPurchaseAction(
  _previousState: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const context = await requireAdmin();
  const result = customerCreditPurchaseReversalSchema.safeParse({
    purchaseId: formData.get("purchaseId"),
    customerId: formData.get("customerId"),
    reason: formData.get("reason"),
    confirmation: formData.get("confirmation"),
  });

  if (!result.success) {
    return {
      message: result.error.issues[0]?.message ?? "Check the reversal details.",
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    await reverseCustomerCreditPurchase(
      context,
      result.data.purchaseId,
      result.data.reason,
    );
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Customer credit purchase could not be reversed.",
    };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${result.data.customerId}`);
  redirect(`/customers/${result.data.customerId}?purchaseReversed=1`);
}

export async function createCustomerPaymentAction(
  _previousState: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const context = await requireBusinessMember();
  const result = customerPaymentInputSchema.safeParse({
    customerId: formData.get("customerId"),
    businessDayId: formData.get("businessDayId"),
    amountRon: formData.get("amountRon"),
    financialAccountId: formData.get("financialAccountId"),
    idempotencyKey: formData.get("idempotencyKey"),
    notes: formData.get("notes"),
    allocationStrategy: formData.get("allocationStrategy"),
    manualAllocations: parseManualAllocations(
      formData.get("manualAllocations"),
    ),
    auditReason: formData.get("auditReason"),
  });

  if (!result.success) {
    return {
      message:
        result.error.issues[0]?.message ??
        "Check the customer payment details.",
      errors: result.error.flatten().fieldErrors,
    };
  }

  if (context.role === "employee") {
    const openDay = await getOpenBusinessDay(context.business.id);

    if (!openDay || openDay.id !== result.data.businessDayId) {
      return {
        message: "Employees must use the current open business day.",
        errors: {
          businessDayId: ["Select the current open business day."],
        },
      };
    }
  }

  try {
    await createCustomerPayment(context, result.data);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Customer payment could not be recorded.",
    };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${result.data.customerId}`);
  revalidatePath("/cash-and-bank");
  redirect(`/customers/${result.data.customerId}?paymentCreated=1`);
}

export async function reverseCustomerPaymentAction(
  _previousState: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const context = await requireAdmin();
  const result = customerPaymentReversalSchema.safeParse({
    paymentId: formData.get("paymentId"),
    customerId: formData.get("customerId"),
    reason: formData.get("reason"),
    confirmation: formData.get("confirmation"),
  });

  if (!result.success) {
    return {
      message:
        result.error.issues[0]?.message ??
        "Check the payment reversal details.",
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    await reverseCustomerPayment(
      context,
      result.data.paymentId,
      result.data.reason,
    );
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Customer payment could not be reversed.",
    };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${result.data.customerId}`);
  revalidatePath("/cash-and-bank");
  redirect(`/customers/${result.data.customerId}?paymentReversed=1`);
}
