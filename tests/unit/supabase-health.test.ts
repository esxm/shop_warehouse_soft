import { describe, expect, it, vi } from "vitest";

import { probeSupabaseHealth } from "@/lib/db/health";

describe("probeSupabaseHealth", () => {
  it("reports a valid Supabase Auth health response", async () => {
    const fetcher = vi.fn(async () => {
      return Response.json({
        name: "GoTrue",
        version: "v2.0.0",
        description: "Auth",
      });
    }) as unknown as typeof fetch;

    await expect(
      probeSupabaseHealth({
        url: "https://example.supabase.co",
        anonKey: "public-key",
        fetcher,
      }),
    ).resolves.toEqual({ ok: true });

    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://example.supabase.co/auth/v1/health"),
      expect.objectContaining({
        cache: "no-store",
        headers: { apikey: "public-key" },
      }),
    );
  });

  it("returns a generic unavailable result without leaking response data", async () => {
    const fetcher = vi.fn(async () => {
      return Response.json(
        { message: "sensitive upstream detail" },
        { status: 500 },
      );
    }) as unknown as typeof fetch;

    await expect(
      probeSupabaseHealth({
        url: "https://example.supabase.co",
        anonKey: "public-key",
        fetcher,
      }),
    ).resolves.toEqual({ ok: false, reason: "unavailable" });
  });

  it("distinguishes a timeout from another connectivity failure", async () => {
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Timed out", "AbortError"));
          });
        });
      },
    ) as unknown as typeof fetch;

    await expect(
      probeSupabaseHealth({
        url: "https://example.supabase.co",
        anonKey: "public-key",
        fetcher,
        timeoutMs: 1,
      }),
    ).resolves.toEqual({ ok: false, reason: "timeout" });
  });
});
