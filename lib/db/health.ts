import { z } from "zod";

const healthResponseSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
});

export type SupabaseHealthResult =
  { ok: true } | { ok: false; reason: "timeout" | "unavailable" };

type HealthProbeOptions = Readonly<{
  url: string;
  anonKey: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}>;

export async function probeSupabaseHealth({
  url,
  anonKey,
  fetcher = fetch,
  timeoutMs = 5_000,
}: HealthProbeOptions): Promise<SupabaseHealthResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher(new URL("/auth/v1/health", url), {
      cache: "no-store",
      headers: {
        apikey: anonKey,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, reason: "unavailable" };
    }

    const payload: unknown = await response.json();

    return healthResponseSchema.safeParse(payload).success
      ? { ok: true }
      : { ok: false, reason: "unavailable" };
  } catch {
    return {
      ok: false,
      reason: controller.signal.aborted ? "timeout" : "unavailable",
    };
  } finally {
    clearTimeout(timeout);
  }
}
