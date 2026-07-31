"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin, requireBusinessMember } from "@/lib/auth/session";
import { getOpenBusinessDay } from "@/services/business-days";
import {
  parseSupplierManualAllocations,
  supplierPaymentInputSchema,
  supplierPaymentReversalSchema,
} from "@/lib/validation/supplier-payments";
import {
  parseSupplierPurchaseLines,
  supplierPurchaseInputSchema,
  supplierPurchaseReversalSchema,
} from "@/lib/validation/supplier-purchases";
import {
  supplierDeactivationSchema,
  supplierInputSchema,
  supplierUpdateSchema,
} from "@/lib/validation/suppliers";
import {
  createSupplierPayment,
  reverseSupplierPayment,
} from "@/services/supplier-payments";
import {
  createSupplierPurchase,
  reverseSupplierPurchase,
} from "@/services/supplier-purchases";
import {
  createSupplier,
  deactivateSupplier,
  updateSupplier,
} from "@/services/suppliers";

export type SupplierActionState = Readonly<{
  message?: string;
  errors?: {
    name?: string[];
    phone?: string[];
    notes?: string[];
    defaultCurrency?: string[];
    confirmation?: string[];
    businessDayId?: string[];
    currency?: string[];
    purchaseExchangeRate?: string[];
    destinationLocationId?: string[];
    lines?: string[];
    description?: string[];
    dueDate?: string[];
    auditReason?: string[];
    reason?: string[];
    originalAmountPaid?: string[];
    paymentExchangeRate?: string[];
    financialAccountId?: string[];
    idempotencyKey?: string[];
    allocationStrategy?: string[];
    manualAllocations?: string[];
  };
}>;

export async function createSupplierAction(
  _previousState: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  const context = await requireBusinessMember();
  const result = supplierInputSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    notes: formData.get("notes"),
    defaultCurrency: formData.get("defaultCurrency"),
  });

  if (!result.success) {
    return {
      message: result.error.issues[0]?.message ?? "Check the supplier details.",
      errors: result.error.flatten().fieldErrors,
    };
  }

  let supplierId: string;

  try {
    supplierId = await createSupplier(context, result.data);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Supplier could not be created.",
    };
  }

  revalidatePath("/suppliers");
  redirect(`/suppliers/${supplierId}?created=1`);
}

export async function updateSupplierAction(
  _previousState: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  const context = await requireBusinessMember();
  const result = supplierUpdateSchema.safeParse({
    supplierId: formData.get("supplierId"),
    name: formData.get("name"),
    phone: formData.get("phone"),
    notes: formData.get("notes"),
    defaultCurrency: formData.get("defaultCurrency"),
  });

  if (!result.success) {
    return {
      message: result.error.issues[0]?.message ?? "Check the supplier details.",
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    await updateSupplier(context, result.data);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Supplier could not be updated.",
    };
  }

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${result.data.supplierId}`);
  redirect(`/suppliers/${result.data.supplierId}?updated=1`);
}

export async function deactivateSupplierAction(
  _previousState: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  const context = await requireAdmin();
  const result = supplierDeactivationSchema.safeParse({
    supplierId: formData.get("supplierId"),
    confirmation: formData.get("confirmation"),
  });

  if (!result.success) {
    return {
      message:
        result.error.issues[0]?.message ?? "Confirm supplier deactivation.",
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    await deactivateSupplier(context, result.data.supplierId);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Supplier could not be deactivated.",
    };
  }

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${result.data.supplierId}`);
  redirect(`/suppliers/${result.data.supplierId}?deactivated=1`);
}

export async function createSupplierPurchaseAction(
  _previousState: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  const context = await requireBusinessMember();
  const result = supplierPurchaseInputSchema.safeParse({
    supplierId: formData.get("supplierId"),
    businessDayId: formData.get("businessDayId"),
    idempotencyKey: formData.get("idempotencyKey"),
    currency: formData.get("currency"),
    purchaseExchangeRate: formData.get("purchaseExchangeRate"),
    destinationLocationId: formData.get("destinationLocationId"),
    lines: parseSupplierPurchaseLines(formData.get("lines")),
    description: formData.get("description"),
    dueDate: formData.get("dueDate"),
    auditReason: formData.get("auditReason"),
  });

  if (!result.success) {
    return {
      message:
        result.error.issues[0]?.message ?? "Check the supplier purchase.",
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
    await createSupplierPurchase(context, result.data);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Supplier purchase could not be created.",
    };
  }

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${result.data.supplierId}`);
  revalidatePath("/inventory-value");
  revalidatePath("/stock");
  redirect(`/suppliers/${result.data.supplierId}?purchaseCreated=1`);
}

export async function reverseSupplierPurchaseAction(
  _previousState: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  const context = await requireAdmin();
  const result = supplierPurchaseReversalSchema.safeParse({
    purchaseId: formData.get("purchaseId"),
    supplierId: formData.get("supplierId"),
    reason: formData.get("reason"),
    allowNegativeStock: formData.get("allowNegativeStock") === "on",
    confirmation: formData.get("confirmation"),
  });

  if (!result.success) {
    return {
      message: result.error.issues[0]?.message ?? "Check the reversal details.",
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    await reverseSupplierPurchase(
      context,
      result.data.purchaseId,
      result.data.reason,
      result.data.allowNegativeStock,
    );
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Supplier purchase could not be reversed.",
    };
  }

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${result.data.supplierId}`);
  revalidatePath("/inventory-value");
  revalidatePath("/stock");
  redirect(`/suppliers/${result.data.supplierId}?purchaseReversed=1`);
}

export async function createSupplierPaymentAction(
  _previousState: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  const context = await requireBusinessMember();
  const result = supplierPaymentInputSchema.safeParse({
    supplierId: formData.get("supplierId"),
    businessDayId: formData.get("businessDayId"),
    currency: formData.get("currency"),
    originalAmountPaid: formData.get("originalAmountPaid"),
    paymentExchangeRate: formData.get("paymentExchangeRate"),
    financialAccountId: formData.get("financialAccountId"),
    idempotencyKey: formData.get("idempotencyKey"),
    notes: formData.get("notes"),
    allocationStrategy: formData.get("allocationStrategy"),
    manualAllocations: parseSupplierManualAllocations(
      formData.get("manualAllocations"),
    ),
    auditReason: formData.get("auditReason"),
  });

  if (!result.success) {
    return {
      message: result.error.issues[0]?.message ?? "Check the supplier payment.",
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
    await createSupplierPayment(context, result.data);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Supplier payment could not be recorded.",
    };
  }

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${result.data.supplierId}`);
  revalidatePath("/cash-and-bank");
  redirect(`/suppliers/${result.data.supplierId}?paymentCreated=1`);
}

export async function reverseSupplierPaymentAction(
  _previousState: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  const context = await requireAdmin();
  const result = supplierPaymentReversalSchema.safeParse({
    paymentId: formData.get("paymentId"),
    supplierId: formData.get("supplierId"),
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
    await reverseSupplierPayment(
      context,
      result.data.paymentId,
      result.data.reason,
    );
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Supplier payment could not be reversed.",
    };
  }

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${result.data.supplierId}`);
  revalidatePath("/cash-and-bank");
  redirect(`/suppliers/${result.data.supplierId}?paymentReversed=1`);
}
