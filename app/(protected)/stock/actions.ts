"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin, requireBusinessMember } from "@/lib/auth/session";
import {
  stockMovementInputSchema,
  stockMovementReversalSchema,
} from "@/lib/validation/stock-movements";
import {
  createStockMovement,
  reverseStockMovement,
} from "@/services/product-stock";

export type StockMovementActionState = Readonly<{
  message?: string;
  errors?: Partial<
    Record<
      | "productId"
      | "entryType"
      | "sourceLocationId"
      | "destinationLocationId"
      | "quantity"
      | "unitCost"
      | "unitCostCurrency"
      | "exchangeRate"
      | "businessDayId"
      | "notes"
      | "idempotencyKey"
      | "referenceId"
      | "allowNegative"
      | "overrideReason"
      | "movementId"
      | "reason"
      | "confirmation",
      string[]
    >
  >;
}>;

export async function createStockMovementAction(
  _previousState: StockMovementActionState,
  formData: FormData,
): Promise<StockMovementActionState> {
  const context = await requireBusinessMember();
  const result = stockMovementInputSchema.safeParse({
    productId: formData.get("productId"),
    entryType: formData.get("entryType"),
    sourceLocationId: formData.get("sourceLocationId"),
    destinationLocationId: formData.get("destinationLocationId"),
    quantity: formData.get("quantity"),
    unitCost: formData.get("unitCost"),
    unitCostCurrency: formData.get("unitCostCurrency"),
    exchangeRate: formData.get("exchangeRate"),
    businessDayId: formData.get("businessDayId"),
    notes: formData.get("notes"),
    idempotencyKey: formData.get("idempotencyKey"),
    referenceId: formData.get("referenceId"),
    allowNegative: formData.get("allowNegative") === "on",
    overrideReason: formData.get("overrideReason"),
  });

  if (!result.success) {
    return {
      message: result.error.issues[0]?.message ?? "Check the stock movement.",
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    await createStockMovement(context, result.data);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Stock movement could not be saved.",
    };
  }

  revalidatePath("/stock");
  revalidatePath("/products");
  revalidatePath(`/products/${result.data.productId}`);
  redirect("/stock?created=1");
}

export async function reverseStockMovementAction(
  _previousState: StockMovementActionState,
  formData: FormData,
): Promise<StockMovementActionState> {
  const context = await requireAdmin();
  const result = stockMovementReversalSchema.safeParse({
    movementId: formData.get("movementId"),
    reason: formData.get("reason"),
    idempotencyKey: formData.get("idempotencyKey"),
    allowNegative: formData.get("allowNegative") === "on",
    confirmation: formData.get("confirmation"),
  });

  if (!result.success) {
    return {
      message: result.error.issues[0]?.message ?? "Check the reversal.",
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    await reverseStockMovement(context, result.data);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Stock movement could not be reversed.",
    };
  }

  revalidatePath("/stock");
  revalidatePath("/products");
  redirect("/stock?reversed=1");
}
