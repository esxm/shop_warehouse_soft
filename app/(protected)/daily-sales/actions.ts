"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin, requireBusinessMember } from "@/lib/auth/session";
import { dailySalesDraftSchema } from "@/lib/validation/daily-sales";
import {
  parseProductSaleLines,
  productSaleInputSchema,
  productSaleReversalSchema,
} from "@/lib/validation/product-sales";
import { upsertDailySalesDraft } from "@/services/daily-sales";
import {
  createProductSale,
  reverseProductSale,
} from "@/services/product-sales";

export type DailySalesActionState = Readonly<{
  message?: string;
  errors?: {
    businessDayId?: string[];
    cashSalesRon?: string[];
    bankSalesRon?: string[];
    creditSalesRon?: string[];
    notes?: string[];
  };
}>;

export type ProductSaleActionState = Readonly<{
  message?: string;
  errors?: Partial<
    Record<
      | "businessDayId"
      | "shopLocationId"
      | "customerId"
      | "cashAmountRon"
      | "bankAmountRon"
      | "creditAmountRon"
      | "idempotencyKey"
      | "lines"
      | "notes"
      | "saleId"
      | "reason"
      | "confirmation",
      string[]
    >
  >;
}>;

export async function saveDailySalesDraftAction(
  _previousState: DailySalesActionState,
  formData: FormData,
): Promise<DailySalesActionState> {
  const context = await requireBusinessMember();
  const result = dailySalesDraftSchema.safeParse({
    businessDayId: formData.get("businessDayId"),
    cashSalesRon: formData.get("cashSalesRon"),
    bankSalesRon: formData.get("bankSalesRon"),
    creditSalesRon: formData.get("creditSalesRon"),
    notes: formData.get("notes"),
  });

  if (!result.success) {
    return {
      message: result.error.issues[0]?.message ?? "Check the daily sales.",
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    await upsertDailySalesDraft(context, result.data);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Daily sales draft could not be saved.",
    };
  }

  revalidatePath("/daily-sales");
  redirect("/daily-sales?saved=1");
}

export async function createProductSaleAction(
  _previousState: ProductSaleActionState,
  formData: FormData,
): Promise<ProductSaleActionState> {
  const context = await requireBusinessMember();
  const result = productSaleInputSchema.safeParse({
    businessDayId: formData.get("businessDayId"),
    shopLocationId: formData.get("shopLocationId"),
    customerId: formData.get("customerId"),
    cashAmountRon: formData.get("cashAmountRon"),
    bankAmountRon: formData.get("bankAmountRon"),
    creditAmountRon: formData.get("creditAmountRon"),
    idempotencyKey: formData.get("idempotencyKey"),
    lines: parseProductSaleLines(formData.get("lines")),
    notes: formData.get("notes"),
  });

  if (!result.success) {
    return {
      message: result.error.issues[0]?.message ?? "Check the product sale.",
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    await createProductSale(context, result.data);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Product sale could not be recorded.",
    };
  }

  revalidatePath("/daily-sales");
  revalidatePath("/stock");
  revalidatePath("/inventory-value");
  revalidatePath("/customers");
  revalidatePath("/cash-and-bank");
  redirect("/daily-sales?saleCreated=1");
}

export async function reverseProductSaleAction(
  _previousState: ProductSaleActionState,
  formData: FormData,
): Promise<ProductSaleActionState> {
  const context = await requireAdmin();
  const result = productSaleReversalSchema.safeParse({
    saleId: formData.get("saleId"),
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
    await reverseProductSale(context, result.data.saleId, result.data.reason);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Product sale could not be reversed.",
    };
  }

  revalidatePath("/daily-sales");
  revalidatePath("/stock");
  revalidatePath("/inventory-value");
  revalidatePath("/customers");
  redirect("/daily-sales?saleReversed=1");
}
