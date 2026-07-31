import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import {
  assertOpenBusinessDayAccess,
  type BusinessDayAccessRecord,
} from "@/lib/auth/permission-rules";
import type {
  AuthenticatedUser,
  AuthState,
  CurrentUserContext,
} from "@/lib/auth/types";
import { createServerSupabaseClient } from "@/lib/db/server";

export const getAuthState = cache(async (): Promise<AuthState> => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { status: "unauthenticated" };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("business_members")
    .select("business_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw new Error("Unable to load the current business membership.");
  }

  const email = user.email ?? "";

  if (!membership) {
    return {
      status: "without-membership",
      user: { id: user.id, email },
    };
  }

  const [profileResult, businessResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("businesses")
      .select("id, name, timezone")
      .eq("id", membership.business_id)
      .single(),
  ]);

  if (profileResult.error || businessResult.error || !businessResult.data) {
    throw new Error("Unable to load the current user and business.");
  }

  const fullName = profileResult.data?.full_name ?? null;

  return {
    status: "member",
    context: {
      user: {
        id: user.id,
        email,
        displayName: fullName ?? email,
      },
      profile: { fullName },
      business: businessResult.data,
      role: membership.role,
    },
  };
});

export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  const state = await getAuthState();

  if (state.status === "unauthenticated") {
    redirect("/login");
  }

  if (state.status === "member") {
    return {
      id: state.context.user.id,
      email: state.context.user.email,
    };
  }

  return state.user;
}

export async function requireBusinessMember(): Promise<CurrentUserContext> {
  const state = await getAuthState();

  if (state.status === "unauthenticated") {
    redirect("/login");
  }

  if (state.status === "without-membership") {
    redirect("/no-access");
  }

  return state.context;
}

export async function requireAdmin(): Promise<CurrentUserContext> {
  const context = await requireBusinessMember();

  if (context.role !== "admin") {
    redirect("/");
  }

  return context;
}

export function redirectEmployeeToDailySales(
  context: CurrentUserContext,
): void {
  if (context.role === "employee") {
    redirect("/daily-sales");
  }
}

export async function requireOpenBusinessDay<
  TBusinessDay extends BusinessDayAccessRecord,
>(
  loadBusinessDay: (businessId: string) => Promise<TBusinessDay | null>,
): Promise<
  Readonly<{
    context: CurrentUserContext;
    businessDay: TBusinessDay;
  }>
> {
  const context = await requireBusinessMember();
  const businessDay = await loadBusinessDay(context.business.id);

  return {
    context,
    businessDay: assertOpenBusinessDayAccess(context, businessDay),
  };
}
