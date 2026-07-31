import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function readProjectFile(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

describe("inventory analysis report interface", () => {
  it("provides date filters, CSV, stock, velocity, sales, and movements", async () => {
    const page = await readProjectFile(
      "app/(protected)/reports/inventory/page.tsx",
    );

    for (const text of [
      "Date range",
      "Export CSV",
      "Current stock and value",
      "Fast-moving products",
      "Slow-moving products",
      "Sales by product",
      "Product movement history",
    ]) {
      expect(page).toContain(text);
    }
  });

  it("explains historical-cost margin limitations", async () => {
    const page = await readProjectFile(
      "app/(protected)/reports/inventory/page.tsx",
    );

    expect(page).toContain("historical weighted cost");
    expect(page).toContain("never the current USD rate");
    expect(page).toContain("exclude operating expenses, taxes, and");
    expect(page).toContain("matches Daily Sales");
    expect(page).toContain("on historical cost");
    expect(page).toContain("report.totalGrossMarginPercent");
    expect(page).toContain("gross margin");
  });

  it("allows only administrators to save thresholds", async () => {
    const page = await readProjectFile(
      "app/(protected)/reports/inventory/page.tsx",
    );
    const actions = await readProjectFile(
      "app/(protected)/reports/inventory/actions.ts",
    );

    expect(page).toContain('context.role === "admin"');
    expect(page).toContain("<StockThresholdForm");
    expect(actions).toContain("requireAdmin()");
  });

  it("adds inventory analysis to report navigation", async () => {
    const navigation = await readProjectFile(
      "components/report-navigation.tsx",
    );

    expect(navigation).toContain(
      '{ href: "/reports/inventory", label: "Inventory analysis" }',
    );
  });

  it("protects CSV with authentication, validation, and no-store caching", async () => {
    const route = await readProjectFile(
      "app/(protected)/reports/inventory.csv/route.ts",
    );

    expect(route).toContain("requireBusinessMember()");
    expect(route).toContain("resolveRevenueQuery");
    expect(route).toContain("private, no-store");
    expect(route).toContain("createInventoryAnalysisCsv");
  });
});
