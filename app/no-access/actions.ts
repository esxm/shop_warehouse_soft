"use server";

import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/db/server";

export async function signOutWithoutAccess() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
