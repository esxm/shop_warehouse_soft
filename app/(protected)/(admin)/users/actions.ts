"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/session";
import {
  employeeAccessSchema,
  employeeInviteSchema,
} from "@/lib/validation/auth";
import {
  inviteBusinessEmployee,
  setBusinessEmployeeActive,
} from "@/services/user-management";

export type InviteEmployeeState = Readonly<{
  status?: "success" | "error";
  message?: string;
  errors?: {
    email?: string[];
    fullName?: string[];
  };
}>;

export type EmployeeAccessState = Readonly<{
  status?: "success" | "error";
  message?: string;
  errors?: {
    confirmation?: string[];
  };
}>;

export async function inviteEmployee(
  _previousState: InviteEmployeeState,
  formData: FormData,
): Promise<InviteEmployeeState> {
  const context = await requireAdmin();
  const result = employeeInviteSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
  });

  if (!result.success) {
    return {
      status: "error",
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    await inviteBusinessEmployee(context, result.data);
  } catch {
    return {
      status: "error",
      message:
        "Invitation failed. Check the email address, SMTP configuration, and whether the account already exists.",
    };
  }

  revalidatePath("/users");
  return {
    status: "success",
    message: `Invitation sent to ${result.data.email}.`,
  };
}

export async function updateEmployeeAccess(
  _previousState: EmployeeAccessState,
  formData: FormData,
): Promise<EmployeeAccessState> {
  const context = await requireAdmin();
  const result = employeeAccessSchema.safeParse({
    userId: formData.get("userId"),
    active: formData.get("active"),
    confirmation: formData.get("confirmation"),
  });

  if (!result.success) {
    return {
      status: "error",
      message: result.error.issues[0]?.message ?? "Check the access change.",
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    await setBusinessEmployeeActive(
      context,
      result.data.userId,
      result.data.active,
    );
  } catch {
    return {
      status: "error",
      message: "Employee access could not be updated.",
    };
  }

  revalidatePath("/users");
  return {
    status: "success",
    message: result.data.active
      ? "Employee access reactivated."
      : "Employee access deactivated.",
  };
}
