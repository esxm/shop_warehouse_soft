import type { ReactNode } from "react";

import { logout } from "@/app/(protected)/actions";
import { PrimaryNavigation } from "@/components/primary-navigation";
import type { CurrentUserContext } from "@/lib/auth/types";

type AppShellProps = Readonly<{
  children: ReactNode;
  context: CurrentUserContext;
}>;

export function AppShell({ children, context }: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="truncate text-base font-bold tracking-tight sm:text-lg">
              Shop & Warehouse
            </p>
            <p className="truncate text-xs text-slate-400">
              {context.business.name}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="max-w-52 truncate text-sm font-semibold">
                {context.user.displayName}
              </p>
              <p className="text-xs capitalize text-slate-400">
                {context.role}
              </p>
            </div>
            <form action={logout}>
              <button
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
                type="submit"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        <PrimaryNavigation role={context.role} />
      </header>
      <main className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-12 lg:px-8">
        {children}
      </main>
    </div>
  );
}
