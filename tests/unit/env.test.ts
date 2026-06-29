import { describe, expect, it } from "vitest";

import { parseEnvironment } from "@/lib/env";

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
});
