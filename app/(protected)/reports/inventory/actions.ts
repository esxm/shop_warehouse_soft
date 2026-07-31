"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/session";
import { stockThresholdInputSchema } from "@/lib/validation/inventory-analysis";
import { setProductStockThreshold } from "@/services/inventory-analysis";

export type StockThresholdActionState = Readonly<{
  message?: string;
  errors?: {
    productId?: string[];
    inventoryLocationId?: string[];
    minimumQuantity?: string[];
  };
}>;

export async function setStockThresholdAction(
  _previousState: StockThresholdActionState,
  formData: FormData,
): Promise<StockThresholdActionState> {
  const context = await requireAdmin();
  const result = stockThresholdInputSchema.safeParse({
    productId: formData.get("productId"),
    inventoryLocationId: formData.get("inventoryLocationId"),
    minimumQuantity: formData.get("minimumQuantity"),
  });

  if (!result.success) {
    return {
      message: result.error.issues[0]?.message ?? "Check the threshold.",
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    await setProductStockThreshold(context, result.data);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Low-stock threshold could not be saved.",
    };
  }

  revalidatePath("/reports/inventory");
  redirect("/reports/inventory?thresholdSaved=1");
}
