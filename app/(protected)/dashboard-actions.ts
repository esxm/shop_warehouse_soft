"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/session";
import { usdRonReferenceRateSchema } from "@/lib/validation/dashboard";
import { recordUsdRonReferenceRate } from "@/services/dashboard";

export type DashboardRateActionState = Readonly<{
  message?: string;
  errors?: Partial<Record<"rate" | "effectiveDate", string[]>>;
}>;

export async function recordUsdRonReferenceRateAction(
  _previousState: DashboardRateActionState,
  formData: FormData,
): Promise<DashboardRateActionState> {
  const context = await requireAdmin();
  const result = usdRonReferenceRateSchema.safeParse({
    rate: formData.get("rate"),
    effectiveDate: formData.get("effectiveDate"),
  });

  if (!result.success) {
    return {
      message:
        result.error.issues[0]?.message ?? "Check the USD/RON reference rate.",
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    await recordUsdRonReferenceRate(context, result.data);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "USD/RON reference rate could not be recorded.",
    };
  }

  revalidatePath("/");
  redirect("/?rateUpdated=1");
}
