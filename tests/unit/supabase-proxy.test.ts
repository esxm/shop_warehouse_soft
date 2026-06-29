import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";

import { config } from "../../proxy";

describe("Supabase session proxy matcher", () => {
  it.each(["/", "/api/health/supabase", "/customers"])(
    "runs for application path %s",
    (url) => {
      expect(
        unstable_doesMiddlewareMatch({
          config,
          nextConfig: {},
          url,
        }),
      ).toBe(true);
    },
  );

  it.each(["/_next/static/app.js", "/_next/image", "/logo.svg"])(
    "skips static asset path %s",
    (url) => {
      expect(
        unstable_doesMiddlewareMatch({
          config,
          nextConfig: {},
          url,
        }),
      ).toBe(false);
    },
  );
});
