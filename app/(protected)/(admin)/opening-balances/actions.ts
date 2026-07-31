"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/session";
import {
  getTodayInBusinessTimeZone,
  type BusinessDate,
} from "@/lib/date/business-date";
import {
  openingBalanceSchema,
  openingBalanceReversalSchema,
  parseOpeningBalanceList,
} from "@/lib/validation/opening-balances";
import {
  createOpeningBalance,
  reverseOpeningBalance,
} from "@/services/opening-balances";

export type OpeningBalanceState = Readonly<{
  message?: string;
  errors?: Partial<
    Record<
      | "openingDate"
      | "cashBalanceRon"
      | "bankBalanceRon"
      | "warehouseInventoryRon"
      | "shopInventoryRon"
      | "customerReceivables"
      | "supplierPayables",
      string[]
    >
  >;
}>;

export type OpeningBalanceReversalState = Readonly<{
  message?: string;
  errors?: {
    reason?: string[];
    confirmation?: string[];
  };
}>;

export async function submitOpeningBalances(
  _previousState: OpeningBalanceState,
  formData: FormData,
): Promise<OpeningBalanceState> {
  const context = await requireAdmin();
  const result = openingBalanceSchema.safeParse({
    openingDate: formData.get("openingDate"),
    cashBalanceRon: formData.get("cashBalanceRon"),
    bankBalanceRon: formData.get("bankBalanceRon"),
    warehouseInventoryRon: formData.get("warehouseInventoryRon"),
    shopInventoryRon: formData.get("shopInventoryRon"),
    customerReceivables: parseOpeningBalanceList(
      formData.get("customerReceivables"),
    ),
    supplierPayables: parseOpeningBalanceList(formData.get("supplierPayables")),
  });

  if (!result.success) {
    return {
      message: result.error.issues[0]?.message ?? "Check the submitted values.",
      errors: result.error.flatten().fieldErrors,
    };
  }

  const today = getTodayInBusinessTimeZone(context.business.timezone);

  if ((result.data.openingDate as BusinessDate) > today) {
    return {
      message: "Opening date must not be in the future.",
      errors: {
        openingDate: ["Opening date must not be in the future."],
      },
    };
  }

  try {
    await createOpeningBalance(context, result.data);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Opening balances could not be initialized.",
    };
  }

  revalidatePath("/opening-balances");
  redirect("/opening-balances?created=1");
}

export async function reverseOpeningBalances(
  _previousState: OpeningBalanceReversalState,
  formData: FormData,
): Promise<OpeningBalanceReversalState> {
  const context = await requireAdmin();
  const result = openingBalanceReversalSchema.safeParse({
    batchId: formData.get("batchId"),
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
    await reverseOpeningBalance(context, result.data);
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Opening balances could not be reversed.",
    };
  }

  revalidatePath("/opening-balances");
  redirect("/opening-balances?reversed=1");
}
