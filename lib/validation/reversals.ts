import { z } from "zod";

export const reversalReasonSchema = z
  .string()
  .trim()
  .min(10, "Explain the reversal in at least 10 characters.")
  .max(500, "Reason must not exceed 500 characters.");

export function reversalConfirmationSchema(message: string) {
  return z.literal("confirm", { error: message });
}
