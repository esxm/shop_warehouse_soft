import { afterEach, describe, expect, it, vi } from "vitest";

const supabaseEnvironmentKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const originalValues = Object.fromEntries(
  supabaseEnvironmentKeys.map((key) => [key, process.env[key]]),
);

afterEach(() => {
  supabaseEnvironmentKeys.forEach((key) => {
    const originalValue = originalValues[key];

    if (originalValue === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalValue;
    }
  });

  vi.resetModules();
});

describe("Next.js startup environment validation", () => {
  it("fails clearly when required Supabase variables are missing", async () => {
    supabaseEnvironmentKeys.forEach((key) => {
      delete process.env[key];
    });

    await expect(import("../../next.config")).rejects.toThrow(
      "Invalid environment configuration",
    );
  });
});
