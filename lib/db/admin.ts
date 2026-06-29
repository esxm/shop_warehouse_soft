import "server-only";

import { createClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";

/**
 * Creates a privileged client that bypasses Row Level Security.
 *
 * Callers must authenticate and authorize the operation before using this
 * client. Never import this module from Client Components.
 */
export function createAdminSupabaseClient() {
  return createClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}
