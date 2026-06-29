import { describe, expect, it } from "vitest";

import {
  parseEnvironment,
  parsePublicEnvironment,
  parseServerEnvironment,
} from "@/lib/env";

describe("parseEnvironment", () => {
  it("provides safe local defaults", () => {
    expect(parseEnvironment({})).toEqual({
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_NAME: "Shop & Warehouse",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    });
  });

  it("rejects malformed public URLs with a clear error", () => {
    expect(() =>
      parseEnvironment({ NEXT_PUBLIC_APP_URL: "not-a-url" }),
    ).toThrow("Invalid environment configuration");
  });

  it("requires both public Supabase variables", () => {
    expect(() => parsePublicEnvironment({})).toThrow(
      "NEXT_PUBLIC_SUPABASE_URL",
    );
    expect(() => parsePublicEnvironment({})).toThrow(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  });

  it("accepts a complete public Supabase configuration", () => {
    expect(
      parsePublicEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-key",
      }),
    ).toMatchObject({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-key",
    });
  });

  it("requires the service-role key on the server", () => {
    expect(() =>
      parseServerEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-key",
      }),
    ).toThrow("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("does not include secret values in validation errors", () => {
    const secret = "must-not-appear-in-errors";

    expect(() =>
      parseServerEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-key",
        SUPABASE_SERVICE_ROLE_KEY: secret,
      }),
    ).not.toThrow(secret);
  });
});
