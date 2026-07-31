import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/db/server";

const allowedNextPaths = new Set(["/set-password"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requestedNext = url.searchParams.get("next") ?? "/set-password";
  const nextPath = allowedNextPaths.has(requestedNext)
    ? requestedNext
    : "/set-password";

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(nextPath, url.origin));
    }
  }

  return NextResponse.redirect(new URL("/login", url.origin));
}
