"use server";

import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/db/server";
import { loginSchema } from "@/lib/validation/auth";
import {
  clearAuthRateLimit,
  consumeAuthRateLimit,
} from "@/services/auth-rate-limit";

export type LoginState = Readonly<{
  message?: string;
  errors?: {
    email?: string[];
    password?: string[];
  };
}>;

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const result = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors };
  }

  try {
    const retryAfterSeconds = await consumeAuthRateLimit(
      "login_email",
      result.data.email,
    );

    if (retryAfterSeconds > 0) {
      return {
        message: "Too many sign-in attempts. Try again later.",
      };
    }
  } catch {
    return {
      message: "Sign in is temporarily unavailable. Try again later.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword(result.data);

  if (error) {
    return { message: "The email or password is incorrect." };
  }

  try {
    await clearAuthRateLimit("login_email", result.data.email);
  } catch {
    // Authentication succeeded. A stale throttle row must not block access.
  }

  redirect("/");
}
