"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { getNavigationGroups } from "@/lib/auth/navigation";
import type { MemberRole } from "@/lib/auth/types";

export function PrimaryNavigation({ role }: Readonly<{ role: MemberRole }>) {
  const pathname = usePathname();

  return (
    <PrimaryNavigationMenu key={pathname} pathname={pathname} role={role} />
  );
}

function PrimaryNavigationMenu({
  pathname,
  role,
}: Readonly<{ pathname: string; role: MemberRole }>) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigationGroups = getNavigationGroups(role);
  const isCurrent = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Primary navigation"
      className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
    >
      <button
        aria-controls="mobile-primary-navigation"
        aria-expanded={mobileMenuOpen}
        className="mb-3 flex min-h-11 w-full items-center justify-between rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-100 sm:hidden"
        onClick={() => setMobileMenuOpen((current) => !current)}
        type="button"
      >
        Menu
        <span aria-hidden="true">{mobileMenuOpen ? "Close" : "Open"}</span>
      </button>

      {mobileMenuOpen ? (
        <div
          className="mb-3 space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-3 sm:hidden"
          id="mobile-primary-navigation"
        >
          {navigationGroups.map((group) => (
            <div key={group.label}>
              {group.items.length > 1 ? (
                <p className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {group.label}
                </p>
              ) : null}
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const current = isCurrent(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        aria-current={current ? "page" : undefined}
                        className={
                          current
                            ? "block min-h-11 rounded-xl bg-white px-3 py-3 text-sm font-semibold text-slate-950"
                            : "block min-h-11 rounded-xl px-3 py-3 text-sm font-medium text-slate-100 hover:bg-slate-800"
                        }
                        href={item.href}
                        onClick={() => {
                          setMobileMenuOpen(false);
                          setOpenGroup(null);
                        }}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      <ul className="hidden flex-wrap gap-1 pb-3 sm:flex">
        {navigationGroups.map((group) => {
          if (group.items.length === 1) {
            const item = group.items[0];
            const current = isCurrent(item.href);
            return (
              <li key={group.label}>
                <Link
                  aria-current={current ? "page" : undefined}
                  className={
                    current
                      ? "block min-h-11 rounded-lg bg-white px-3 py-3 text-sm font-semibold text-slate-950"
                      : "block min-h-11 rounded-lg px-3 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                  }
                  href={item.href}
                >
                  {item.label}
                </Link>
              </li>
            );
          }

          const currentGroup = group.items.some((item) => isCurrent(item.href));
          const isOpen = openGroup === group.label;
          return (
            <li
              className="relative"
              key={group.label}
              onBlur={(event) => {
                if (
                  !event.currentTarget.contains(
                    event.relatedTarget as Node | null,
                  )
                ) {
                  setOpenGroup(null);
                }
              }}
              onMouseEnter={() => setOpenGroup(group.label)}
              onMouseLeave={() => setOpenGroup(null)}
            >
              <button
                aria-expanded={isOpen}
                aria-haspopup="true"
                className={
                  currentGroup
                    ? "min-h-11 rounded-lg bg-white px-3 py-3 text-sm font-semibold text-slate-950"
                    : "min-h-11 rounded-lg px-3 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                }
                onClick={() => setOpenGroup(group.label)}
                onFocus={() => setOpenGroup(group.label)}
                type="button"
              >
                {group.label}
                <span
                  aria-hidden="true"
                  className={
                    isOpen
                      ? "ml-2 inline-block rotate-180 transition"
                      : "ml-2 inline-block transition"
                  }
                >
                  ↓
                </span>
              </button>
              <div
                className={
                  isOpen
                    ? "absolute left-0 top-full z-30 block min-w-52 pt-1"
                    : "absolute left-0 top-full z-30 hidden min-w-52 pt-1"
                }
              >
                <ul className="space-y-1 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-xl">
                  {group.items.map((item) => {
                    const current = isCurrent(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          aria-current={current ? "page" : undefined}
                          className={
                            current
                              ? "block min-h-11 rounded-lg bg-white px-3 py-3 text-sm font-semibold text-slate-950"
                              : "block min-h-11 rounded-lg px-3 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800 hover:text-white"
                          }
                          href={item.href}
                          onClick={() => setOpenGroup(null)}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
