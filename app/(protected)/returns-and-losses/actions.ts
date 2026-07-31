"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/session";
import {
  inventoryExceptionInputSchema,
  inventoryExceptionReversalSchema,
  parseSaleReturnLines,
  saleReturnInputSchema,
  saleReturnReversalSchema,
} from "@/lib/validation/returns-and-losses";
import {
  createInventoryException,
  createSaleReturn,
  reverseInventoryException,
  reverseSaleReturn,
} from "@/services/returns-and-losses";

export type ReturnsAndLossesActionState = Readonly<{
  message?: string;
  errors?: Partial<
    Record<
      | "businessDayId"
      | "saleId"
      | "cashRefundRon"
      | "bankRefundRon"
      | "creditReductionRon"
      | "idempotencyKey"
      | "lines"
      | "reason"
      | "productId"
      | "sourceLocationId"
      | "exceptionType"
      | "quantity"
      | "saleReturnId"
      | "inventoryExceptionId"
      | "confirmation",
      string[]
    >
  >;
}>;

function revalidateStep36Paths() {
  revalidatePath("/returns-and-losses");
  revalidatePath("/daily-sales");
  revalidatePath("/stock");
  revalidatePath("/inventory-value");
  revalidatePath("/customers");
  revalidatePath("/cash-and-bank");
  revalidatePath("/reports");
}

export async function createSaleReturnAction(
  _previousState: ReturnsAndLossesActionState,
  formData: FormData,
): Promise<ReturnsAndLossesActionState> {
  const context = await requireAdmin();
  const result = saleReturnInputSchema.safeParse({
    businessDayId: formData.get("businessDayId"),
    saleId: formData.get("saleId"),
    cashRefundRon: formData.get("cashRefundRon"),
    bankRefundRon: formData.get("bankRefundRon"),
    creditReductionRon: formData.get("creditReductionRon"),
    idempotencyKey: formData.get("idempotencyKey"),
    lines: parseSaleReturnLines(formData.get("lines")),
    reason: formData.get("reason"),
  });

  if (!result.success) {
    return {
      message: result.error.issues[0]?.message ?? "Check the sale return.",
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    await createSaleReturn(context, result.data);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Sale return could not be recorded.",
    };
  }

  revalidateStep36Paths();
  redirect("/returns-and-losses?returnCreated=1");
}

export async function reverseSaleReturnAction(
  _previousState: ReturnsAndLossesActionState,
  formData: FormData,
): Promise<ReturnsAndLossesActionState> {
  const context = await requireAdmin();
  const result = saleReturnReversalSchema.safeParse({
    saleReturnId: formData.get("saleReturnId"),
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
    await reverseSaleReturn(
      context,
      result.data.saleReturnId,
      result.data.reason,
    );
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Sale return could not be reversed.",
    };
  }

  revalidateStep36Paths();
  redirect("/returns-and-losses?returnReversed=1");
}

export async function createInventoryExceptionAction(
  _previousState: ReturnsAndLossesActionState,
  formData: FormData,
): Promise<ReturnsAndLossesActionState> {
  const context = await requireAdmin();
  const result = inventoryExceptionInputSchema.safeParse({
    businessDayId: formData.get("businessDayId"),
    productId: formData.get("productId"),
    sourceLocationId: formData.get("sourceLocationId"),
    exceptionType: formData.get("exceptionType"),
    quantity: formData.get("quantity"),
    idempotencyKey: formData.get("idempotencyKey"),
    reason: formData.get("reason"),
  });

  if (!result.success) {
    return {
      message:
        result.error.issues[0]?.message ?? "Check the inventory exception.",
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    await createInventoryException(context, result.data);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Inventory exception could not be recorded.",
    };
  }

  revalidateStep36Paths();
  redirect("/returns-and-losses?exceptionCreated=1");
}

export async function reverseInventoryExceptionAction(
  _previousState: ReturnsAndLossesActionState,
  formData: FormData,
): Promise<ReturnsAndLossesActionState> {
  const context = await requireAdmin();
  const result = inventoryExceptionReversalSchema.safeParse({
    inventoryExceptionId: formData.get("inventoryExceptionId"),
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
    await reverseInventoryException(
      context,
      result.data.inventoryExceptionId,
      result.data.reason,
    );
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Inventory exception could not be reversed.",
    };
  }

  revalidateStep36Paths();
  redirect("/returns-and-losses?exceptionReversed=1");
}
