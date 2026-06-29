import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/db/database.types";
import { publicEnv } from "@/lib/env/public";

export function createBrowserSupabaseClient() {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
