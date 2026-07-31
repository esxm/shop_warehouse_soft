"use server";

import { createServerSupabaseClient } from "@/lib/db/server";
import { publicEnv } from "@/lib/env/public";
import { passwordResetRequestSchema } from "@/lib/validation/auth";
import { consumeAuthRateLimit } from "@/services/auth-rate-limit";

export type ForgotPasswordState = Readonly<{
  status?: "success" | "error";
  message?: string;
  errors?: {
    email?: string[];
  };
}>;

const genericSuccessMessage =
  "If that account exists, a password-reset link has been sent.";

export async function requestPasswordReset(
  _previousState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const result = passwordResetRequestSchema.safeParse({
    email: formData.get("email"),
  });

  if (!result.success) {
    return {
      status: "error",
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    const retryAfterSeconds = await consumeAuthRateLimit(
      "password_reset_email",
      result.data.email,
    );

    if (retryAfterSeconds > 0) {
      return { status: "success", message: genericSuccessMessage };
    }
  } catch {
    return {
      status: "error",
      message: "Password reset is temporarily unavailable. Try again later.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const redirectTo = new URL("/auth/callback", publicEnv.NEXT_PUBLIC_APP_URL);
  redirectTo.searchParams.set("next", "/set-password");

  await supabase.auth.resetPasswordForEmail(result.data.email, {
    redirectTo: redirectTo.toString(),
  });

  return { status: "success", message: genericSuccessMessage };
}
