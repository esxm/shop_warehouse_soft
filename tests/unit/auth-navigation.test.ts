import { describe, expect, it } from "vitest";

import {
  canAccessRoute,
  getNavigationGroups,
  getNavigationItems,
  isAdminRoute,
} from "@/lib/auth/navigation";

describe("role-aware navigation and route permissions", () => {
  it("shows only sales and stock links to employees", () => {
    const employeeLabels = getNavigationItems("employee").map(
      (item) => item.label,
    );

    expect(employeeLabels).toEqual(["Daily Sales", "Products & Stock"]);
    expect(employeeLabels).not.toContain("Dashboard");
    expect(employeeLabels).not.toContain("Customers");
    expect(employeeLabels).not.toContain("Reports");
    expect(employeeLabels).not.toContain("Cash and Bank");
    expect(employeeLabels).not.toContain("Suppliers");
    expect(employeeLabels).not.toContain("Expenses");
    expect(employeeLabels).not.toContain("Users");
    expect(employeeLabels).not.toContain("Audit Log");
    expect(employeeLabels).not.toContain("Opening Balances");
  });

  it("shows administrator links to admins", () => {
    const adminLabels = getNavigationItems("admin").map((item) => item.label);

    expect(adminLabels).toContain("Users");
    expect(adminLabels).toContain("Audit Log");
    expect(adminLabels).toContain("Opening Balances");
  });

  it("orders the operational links by the requested workflow", () => {
    const adminLabels = getNavigationItems("admin").map((item) => item.label);

    expect(adminLabels.slice(2, 9)).toEqual([
      "Products & Stock",
      "Product Inventory",
      "Cash and Bank",
      "Suppliers",
      "Customers",
      "Expenses",
      "Returns & Losses",
    ]);
  });

  it("groups related header links into compact menus", () => {
    const groups = getNavigationGroups("admin");

    expect(
      groups
        .find((group) => group.label === "Inventory")
        ?.items.map((item) => item.label),
    ).toEqual(["Products & Stock", "Product Inventory"]);
    expect(
      groups
        .find((group) => group.label === "Costs & corrections")
        ?.items.map((item) => item.label),
    ).toEqual(["Expenses", "Returns & Losses"]);
  });

  it("limits employee access to the sales and stock workflow", () => {
    expect(isAdminRoute("/users")).toBe(true);
    expect(isAdminRoute("/audit-log/entry")).toBe(true);
    expect(canAccessRoute("employee", "/")).toBe(true);
    expect(canAccessRoute("employee", "/daily-sales")).toBe(true);
    expect(canAccessRoute("employee", "/stock")).toBe(true);
    expect(canAccessRoute("employee", "/users")).toBe(false);
    expect(canAccessRoute("employee", "/audit-log")).toBe(false);
    expect(canAccessRoute("employee", "/opening-balances")).toBe(false);
    expect(canAccessRoute("employee", "/customers")).toBe(false);
    expect(canAccessRoute("employee", "/reports")).toBe(false);
    expect(canAccessRoute("employee", "/cash-and-bank")).toBe(false);
    expect(canAccessRoute("employee", "/suppliers")).toBe(false);
    expect(canAccessRoute("employee", "/expenses")).toBe(false);
    expect(canAccessRoute("admin", "/users")).toBe(true);
  });
});
