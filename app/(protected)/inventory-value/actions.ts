"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin, requireBusinessMember } from "@/lib/auth/session";
import {
  inventoryStocktakeInputSchema,
  inventoryStocktakeReversalSchema,
} from "@/lib/validation/inventory-stocktakes";
import {
  parseInventoryTransferLines,
  inventoryTransferInputSchema,
  inventoryTransferReversalSchema,
} from "@/lib/validation/inventory-transfers";
import {
  createInventoryStocktake,
  createInventoryTransfer,
  reverseInventoryStocktake,
  reverseInventoryTransfer,
} from "@/services/inventory-value";

export type InventoryTransferActionState = Readonly<{
  message?: string;
  errors?: Partial<
    Record<
      | "businessDayId"
      | "sourceLocationId"
      | "destinationLocationId"
      | "lines"
      | "notes"
      | "idempotencyKey"
      | "auditReason"
      | "transferId"
      | "reason"
      | "confirmation",
      string[]
    >
  >;
}>;

export type InventoryStocktakeActionState = Readonly<{
  message?: string;
  errors?: Partial<
    Record<
      | "stocktakeDate"
      | "warehouseActualValueRon"
      | "shopActualValueRon"
      | "reason"
      | "notes"
      | "idempotencyKey"
      | "stocktakeId"
      | "confirmation",
      string[]
    >
  >;
}>;

export async function createInventoryTransferAction(
  _previousState: InventoryTransferActionState,
  formData: FormData,
): Promise<InventoryTransferActionState> {
  const context = await requireBusinessMember();
  const result = inventoryTransferInputSchema.safeParse({
    businessDayId: formData.get("businessDayId"),
    sourceLocationId: formData.get("sourceLocationId"),
    destinationLocationId: formData.get("destinationLocationId"),
    lines: parseInventoryTransferLines(formData.get("lines")),
    notes: formData.get("notes"),
    idempotencyKey: formData.get("idempotencyKey"),
    auditReason: formData.get("auditReason"),
  });

  if (!result.success) {
    return {
      message: result.error.issues[0]?.message ?? "Check the transfer.",
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    await createInventoryTransfer(context, result.data);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Inventory transfer could not be saved.",
    };
  }

  revalidatePath("/inventory-value");
  revalidatePath("/stock");
  redirect("/inventory-value?transferred=1");
}

export async function reverseInventoryTransferAction(
  _previousState: InventoryTransferActionState,
  formData: FormData,
): Promise<InventoryTransferActionState> {
  const context = await requireAdmin();
  const result = inventoryTransferReversalSchema.safeParse({
    transferId: formData.get("transferId"),
    reason: formData.get("reason"),
    allowNegativeStock: formData.get("allowNegativeStock") === "on",
    confirmation: formData.get("confirmation"),
  });

  if (!result.success) {
    return {
      message: result.error.issues[0]?.message ?? "Check the reversal.",
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    await reverseInventoryTransfer(
      context,
      result.data.transferId,
      result.data.reason,
      result.data.allowNegativeStock,
    );
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Inventory transfer could not be reversed.",
    };
  }

  revalidatePath("/inventory-value");
  revalidatePath("/stock");
  redirect("/inventory-value?transferReversed=1");
}

export async function createInventoryStocktakeAction(
  _previousState: InventoryStocktakeActionState,
  formData: FormData,
): Promise<InventoryStocktakeActionState> {
  const context = await requireAdmin();
  const result = inventoryStocktakeInputSchema.safeParse({
    stocktakeDate: formData.get("stocktakeDate"),
    warehouseActualValueRon: formData.get("warehouseActualValueRon"),
    shopActualValueRon: formData.get("shopActualValueRon"),
    reason: formData.get("reason"),
    notes: formData.get("notes"),
    idempotencyKey: formData.get("idempotencyKey"),
  });

  if (!result.success) {
    return {
      message: result.error.issues[0]?.message ?? "Check the stocktake.",
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    await createInventoryStocktake(context, result.data);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Inventory stocktake could not be saved.",
    };
  }

  revalidatePath("/inventory-value");
  redirect("/inventory-value?stocktakeCreated=1");
}

export async function reverseInventoryStocktakeAction(
  _previousState: InventoryStocktakeActionState,
  formData: FormData,
): Promise<InventoryStocktakeActionState> {
  const context = await requireAdmin();
  const result = inventoryStocktakeReversalSchema.safeParse({
    stocktakeId: formData.get("stocktakeId"),
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
    await reverseInventoryStocktake(
      context,
      result.data.stocktakeId,
      result.data.reason,
    );
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Inventory stocktake could not be reversed.",
    };
  }

  revalidatePath("/inventory-value");
  redirect("/inventory-value?stocktakeReversed=1");
}
