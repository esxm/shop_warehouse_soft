import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { requireBusinessMember } from "@/lib/auth/session";

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const context = await requireBusinessMember();

  return <AppShell context={context}>{children}</AppShell>;
}
