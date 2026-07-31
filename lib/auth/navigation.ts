import type { MemberRole } from "@/lib/auth/types";

export type NavigationItem = Readonly<{
  label: string;
  href: string;
  adminOnly?: boolean;
}>;

export type NavigationGroup = Readonly<{
  label: string;
  items: readonly NavigationItem[];
}>;

const navigationItems: readonly NavigationItem[] = [
  { label: "Dashboard", href: "/" },
  { label: "Daily Sales", href: "/daily-sales" },
  { label: "Products & Stock", href: "/stock" },
  { label: "Product Inventory", href: "/inventory-value" },
  { label: "Cash and Bank", href: "/cash-and-bank" },
  { label: "Suppliers", href: "/suppliers" },
  { label: "Customers", href: "/customers" },
  { label: "Expenses", href: "/expenses" },
  {
    label: "Returns & Losses",
    href: "/returns-and-losses",
    adminOnly: true,
  },
  { label: "Reports", href: "/reports" },
  {
    label: "Opening Balances",
    href: "/opening-balances",
    adminOnly: true,
  },
  { label: "Audit Log", href: "/audit-log", adminOnly: true },
  { label: "Users", href: "/users", adminOnly: true },
];

const employeeNavigationItems: readonly NavigationItem[] =
  navigationItems.filter(
    (item) => item.href === "/daily-sales" || item.href === "/stock",
  );

export function getNavigationItems(
  role: MemberRole,
): readonly NavigationItem[] {
  if (role === "employee") {
    return employeeNavigationItems;
  }

  return navigationItems.filter((item) => !item.adminOnly || role === "admin");
}

export function getNavigationGroups(
  role: MemberRole,
): readonly NavigationGroup[] {
  const visibleItems = getNavigationItems(role);
  const byLabel = new Map(visibleItems.map((item) => [item.label, item]));
  const group = (label: string, itemLabels: readonly string[]) => ({
    label,
    items: itemLabels.flatMap((itemLabel) => {
      const item = byLabel.get(itemLabel);
      return item ? [item] : [];
    }),
  });

  return [
    group("Home", ["Dashboard"]),
    group("Sales", ["Daily Sales", "Customers"]),
    group("Inventory", ["Products & Stock", "Product Inventory"]),
    group("Finance", ["Cash and Bank", "Suppliers"]),
    group("Costs & corrections", ["Expenses", "Returns & Losses"]),
    group("Reports", ["Reports"]),
    group("Administration", ["Opening Balances", "Audit Log", "Users"]),
  ].filter((navigationGroup) => navigationGroup.items.length > 0);
}

export function isAdminRoute(pathname: string): boolean {
  return (
    pathname === "/audit-log" ||
    pathname.startsWith("/audit-log/") ||
    pathname === "/opening-balances" ||
    pathname.startsWith("/opening-balances/") ||
    pathname === "/returns-and-losses" ||
    pathname.startsWith("/returns-and-losses/") ||
    pathname === "/users" ||
    pathname.startsWith("/users/")
  );
}

export function canAccessRoute(role: MemberRole, pathname: string): boolean {
  if (role === "admin") {
    return true;
  }

  return (
    pathname === "/" ||
    pathname === "/daily-sales" ||
    pathname.startsWith("/daily-sales/") ||
    pathname === "/stock" ||
    pathname.startsWith("/stock/") ||
    pathname === "/set-password" ||
    pathname.startsWith("/set-password/")
  );
}
