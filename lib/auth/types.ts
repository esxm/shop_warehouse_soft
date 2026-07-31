import type { Enums } from "@/lib/db/database.types";

export type MemberRole = Enums<"member_role">;

export type AuthenticatedUser = Readonly<{
  id: string;
  email: string;
}>;

export type CurrentUserContext = Readonly<{
  user: AuthenticatedUser & {
    displayName: string;
  };
  profile: {
    fullName: string | null;
  };
  business: {
    id: string;
    name: string;
    timezone: string;
  };
  role: MemberRole;
}>;

export type AuthState =
  | Readonly<{ status: "unauthenticated" }>
  | Readonly<{
      status: "without-membership";
      user: { id: string; email: string };
    }>
  | Readonly<{ status: "member"; context: CurrentUserContext }>;
