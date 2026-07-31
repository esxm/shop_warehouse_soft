"use server";

import { redirect } from "next/navigation";

import { requireBusinessMember } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/db/server";
import { passwordUpdateSchema } from "@/lib/validation/auth";

export type PasswordState = Readonly<{
  message?: string;
  errors?: {
    password?: string[];
    confirmPassword?: string[];
  };
}>;

export async function updatePassword(
  _previousState: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  await requireBusinessMember();

  const result = passwordUpdateSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.updateUser({
    password: result.data.password,
  });

  if (error) {
    return { message: "The password could not be updated. Try again." };
  }

  redirect("/");
}
