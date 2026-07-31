import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function readProjectFile(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

describe("dashboard page", () => {
  it("renders current metrics, quick actions, and explicit estimate labels", async () => {
    const page = await readProjectFile("app/(protected)/(dashboard)/page.tsx");

    expect(page).toContain("getDashboardData");
    expect(page).toContain("Today's sales");
    expect(page).toContain("Current month sales");
    expect(page).toContain("Supplier payables");
    expect(page).toContain("Product-valued inventory");
    expect(page).not.toContain("Warehouse inventory value");
    expect(page).not.toContain("Shop inventory value");
    expect(page).toContain("Net business value");
    expect(page).toContain("Estimated total");
    expect(page).toContain("Quick actions");
    expect(page).not.toContain("PlaceholderPage");
  });

  it("loads each source through a business-scoped server service", async () => {
    const service = await readProjectFile("services/dashboard.ts");

    expect(service).toContain('.eq("status", "closed")');
    expect(service).toContain('from("financial_account_balances")');
    expect(service).toContain('from("customer_receivable_balances")');
    expect(service).toContain('from("supplier_payable_balances")');
    expect(service).toContain('from("product_stock_valuation_by_location")');
    expect(service).toContain(
      "new Decimal(row.inventory_value_ron).toFixed(2)",
    );
    expect(service).toContain('from("currency_reference_rate_summaries")');
    expect(service).toContain('.eq("business_id", context.business.id)');
  });

  it("provides route loading and retryable error states", async () => {
    const [loading, error] = await Promise.all([
      readProjectFile("app/(protected)/(dashboard)/loading.tsx"),
      readProjectFile("app/(protected)/(dashboard)/error.tsx"),
    ]);

    expect(loading).toContain('aria-label="Loading dashboard"');
    expect(error).toContain('"use client"');
    expect(error).toContain("unstable_retry");
  });
});
