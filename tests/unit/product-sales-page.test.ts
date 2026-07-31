import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function readProjectFile(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

describe("product sales interface", () => {
  it("records individual product lines with manual selling prices", async () => {
    const form = await readProjectFile("components/product-sale-form.tsx");

    expect(form).toContain("Products sold");
    expect(form).toContain("Selling price (RON)");
    expect(form).toContain("Add product line");
    expect(form).toContain("Payment split");
  });

  it("reports an internal product-value mismatch clearly", async () => {
    const service = await readProjectFile("services/product-sales.ts");

    expect(service).toContain(
      "Inventory movement exceeds source inventory value",
    );
    expect(service).toContain(
      "Shop product value is not synchronized with its stock",
    );
  });

  it("shows exact sale and day profit from database summaries", async () => {
    const page = await readProjectFile("app/(protected)/daily-sales/page.tsx");

    expect(page).toContain("Individual sale history");
    expect(page).toContain("Today&apos;s exact totals");
    expect(page).toContain("line.unitCostRon");
    expect(page).toContain("sale.grossProfitRon");
    expect(page).toContain("currentSummary?.profitPercent");
  });

  it("uses the signed-in member identity when a profile name is absent", async () => {
    const page = await readProjectFile("app/(protected)/daily-sales/page.tsx");

    expect(page).toContain("sale.createdBy === context.user.id");
    expect(page).toContain("context.user.displayName");
    expect(page).not.toContain("Unknown employee");
  });

  it("offers correction only to administrators for an active open-day sale", async () => {
    const page = await readProjectFile("app/(protected)/daily-sales/page.tsx");

    expect(page).toContain('context.role === "admin"');
    expect(page).toContain('sale.status === "active"');
    expect(page).toContain("openDay?.id === sale.businessDayId");
    expect(page).toContain("<ProductSaleReversalForm");
  });

  it("reports primary USD value and two-decimal weighted RON cost", async () => {
    const page = await readProjectFile(
      "app/(protected)/inventory-value/page.tsx",
    );
    const service = await readProjectFile("services/inventory-value.ts");

    expect(page).toContain("Product-valued inventory");
    expect(page).toContain("USD price / piece");
    expect(page).toContain("Inventory total (USD)");
    expect(page).toContain("Stored USD product price");
    expect(service).toContain('from("product_stock_valuation_by_location")');
    expect(service).toContain("inventory_value_usd");
    expect(service).toContain("average_unit_cost_usd");
  });
});
