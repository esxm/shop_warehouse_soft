import { createBrowserClient } from "@supabase/ssr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createBrowserSupabaseClient } from "@/lib/db/browser";

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn(() => ({ client: "browser" })),
}));

describe("createBrowserSupabaseClient", () => {
  beforeEach(() => {
    vi.mocked(createBrowserClient).mockClear();
  });

  it("uses only the validated public URL and key", () => {
    expect(createBrowserSupabaseClient()).toEqual({ client: "browser" });
    expect(createBrowserClient).toHaveBeenCalledWith(
      "http://127.0.0.1:54321",
      "unit-test-public-key",
    );
  });
});
