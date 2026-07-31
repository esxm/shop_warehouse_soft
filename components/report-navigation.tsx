"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const reportLinks = [
  { href: "/reports", label: "Revenue" },
  { href: "/reports/profit", label: "Profit" },
  { href: "/reports/receivables", label: "Customer receivables" },
  { href: "/reports/payables", label: "Supplier payables" },
  { href: "/reports/cash-and-bank", label: "Cash and bank" },
  { href: "/reports/business-position", label: "Business position" },
  { href: "/reports/inventory", label: "Inventory analysis" },
] as const;

export function ReportNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Financial reports"
      className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"
    >
      <ul className="flex min-w-max gap-1">
        {reportLinks.map((link) => {
          const active =
            link.href === "/reports"
              ? pathname === link.href
              : pathname === link.href || pathname.startsWith(`${link.href}/`);

          return (
            <li key={link.href}>
              <Link
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "flex min-h-11 items-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"
                    : "flex min-h-11 items-center rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                }
                href={link.href}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
