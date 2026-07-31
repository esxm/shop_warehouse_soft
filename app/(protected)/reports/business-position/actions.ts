"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/session";
import { businessPositionSnapshotSchema } from "@/lib/reports/business-position";
import { saveBusinessPositionSnapshot } from "@/services/business-position-report";

export type BusinessPositionSnapshotActionState = Readonly<{
  message?: string;
  errors?: Partial<Record<"snapshotDate" | "usdRonRate", string[]>>;
}>;

export async function saveBusinessPositionSnapshotAction(
  _previousState: BusinessPositionSnapshotActionState,
  formData: FormData,
): Promise<BusinessPositionSnapshotActionState> {
  const context = await requireAdmin();
  const result = businessPositionSnapshotSchema.safeParse({
    snapshotDate: formData.get("snapshotDate"),
    usdRonRate: formData.get("usdRonRate"),
  });

  if (!result.success) {
    return {
      message:
        result.error.issues[0]?.message ??
        "Check the business-position snapshot.",
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    await saveBusinessPositionSnapshot(context, result.data);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Business-position snapshot could not be saved.",
    };
  }

  revalidatePath("/reports/business-position");
  redirect("/reports/business-position?snapshotSaved=1");
}
