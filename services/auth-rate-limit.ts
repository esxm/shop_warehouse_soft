import "server-only";

import { createAdminSupabaseClient } from "@/lib/db/admin";

export type AuthRateLimitScope = "login_email" | "password_reset_email";

export async function consumeAuthRateLimit(
  scope: AuthRateLimitScope,
  identifier: string,
): Promise<number> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.rpc("consume_auth_rate_limit", {
    target_scope: scope,
    target_identifier: identifier,
  });

  if (error || data === null) {
    throw new Error("Authentication rate limiter is unavailable.");
  }

  return data;
}

export async function clearAuthRateLimit(
  scope: AuthRateLimitScope,
  identifier: string,
): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin.rpc("clear_auth_rate_limit", {
    target_scope: scope,
    target_identifier: identifier,
  });

  if (error) {
    throw new Error("Authentication rate limiter could not be cleared.");
  }
}
