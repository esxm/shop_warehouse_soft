import type { ReactNode } from "react";

const navigationItems = [
  "Dashboard",
  "Daily Sales",
  "Customers",
  "Suppliers",
  "Cash & Bank",
  "Inventory Value",
  "Expenses",
  "Reports",
] as const;

type AppShellProps = Readonly<{
  children: ReactNode;
}>;

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-lg font-bold tracking-tight">Shop & Warehouse</p>
            <p className="text-xs text-slate-400">Management system</p>
          </div>
          <span className="rounded-full bg-teal-400/15 px-3 py-1 text-xs font-semibold text-teal-300">
            Foundation
          </span>
        </div>
        <nav
          aria-label="Primary navigation"
          className="mx-auto max-w-7xl overflow-x-auto px-4 sm:px-6 lg:px-8"
        >
          <ul className="flex min-w-max gap-1 pb-3">
            {navigationItems.map((item, index) => (
              <li key={item}>
                <a
                  aria-current={index === 0 ? "page" : undefined}
                  className={
                    index === 0
                      ? "block rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-950"
                      : "block rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                  }
                  href={
                    index === 0
                      ? "/"
                      : `#${item.toLowerCase().replaceAll(" ", "-")}`
                  }
                >
                  {item}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {children}
      </main>
    </div>
  );
}
