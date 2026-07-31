import "server-only";

import type { CurrentUserContext } from "@/lib/auth/types";
import { createAdminSupabaseClient } from "@/lib/db/admin";
import { createServerSupabaseClient } from "@/lib/db/server";
import { publicEnv } from "@/lib/env/public";

export type BusinessUser = Readonly<{
  id: string;
  email: string;
  fullName: string | null;
  role: "admin" | "employee";
  isActive: boolean;
}>;

function assertAdminContext(context: CurrentUserContext) {
  if (context.role !== "admin") {
    throw new Error("Administrator access is required.");
  }
}

export async function listBusinessUsers(
  context: CurrentUserContext,
): Promise<readonly BusinessUser[]> {
  assertAdminContext(context);
  const admin = createAdminSupabaseClient();
  const { data: memberships, error } = await admin
    .from("business_members")
    .select("user_id, role, is_active")
    .eq("business_id", context.business.id)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("Unable to load business users.");
  }

  return Promise.all(
    memberships.map(async (membership) => {
      const [{ data: authData }, { data: profile }] = await Promise.all([
        admin.auth.admin.getUserById(membership.user_id),
        admin
          .from("profiles")
          .select("full_name")
          .eq("id", membership.user_id)
          .maybeSingle(),
      ]);

      return {
        id: membership.user_id,
        email: authData.user?.email ?? "Email unavailable",
        fullName: profile?.full_name ?? null,
        role: membership.role,
        isActive: membership.is_active,
      };
    }),
  );
}

export async function inviteBusinessEmployee(
  context: CurrentUserContext,
  input: Readonly<{ email: string; fullName: string }>,
): Promise<void> {
  assertAdminContext(context);
  const admin = createAdminSupabaseClient();
  const redirectTo = new URL("/auth/invite", publicEnv.NEXT_PUBLIC_APP_URL);
  const { data, error } = await admin.auth.admin.inviteUserByEmail(
    input.email,
    {
      data: { full_name: input.fullName },
      redirectTo: redirectTo.toString(),
    },
  );

  if (error || !data.user) {
    throw new Error("The invitation could not be sent.");
  }

  const supabase = await createServerSupabaseClient();
  const { error: membershipError } = await supabase.rpc(
    "add_business_employee",
    {
      target_business_id: context.business.id,
      target_user_id: data.user.id,
    },
  );

  if (membershipError) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw new Error("The employee could not be added to this business.");
  }
}

export async function setBusinessEmployeeActive(
  context: CurrentUserContext,
  userId: string,
  active: boolean,
): Promise<void> {
  assertAdminContext(context);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("set_business_employee_active", {
    target_active: active,
    target_business_id: context.business.id,
    target_user_id: userId,
  });

  if (error) {
    throw new Error("Employee access could not be updated.");
  }
}
