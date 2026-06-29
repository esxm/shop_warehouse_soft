import { probeSupabaseHealth } from "@/lib/db/health";
import { publicEnv } from "@/lib/env/public";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await probeSupabaseHealth({
    url: publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  return Response.json(
    {
      service: "supabase",
      status: health.ok ? "ok" : "unavailable",
    },
    {
      status: health.ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
