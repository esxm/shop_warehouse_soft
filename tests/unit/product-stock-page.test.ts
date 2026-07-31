import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function readProjectFile(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

describe("product stock route", () => {
  it("renders derived location balances, movement entry, and history", async () => {
    const page = await readProjectFile("app/(protected)/stock/page.tsx");

    expect(page).toContain("getProductStockBalances");
    expect(page).toContain("Stock by location");
    expect(page).toContain("Search product");
    expect(page).toContain('name="q"');
    expect(page).toContain('name="location"');
    expect(page).toContain("filteredProductRows");
    expect(page).toContain("<StockMovementForm");
    expect(page).toContain("Movement history");
    expect(page).toContain("<HistoryPeriodFilter");
    expect(page).toContain('name="movement_filter"');
    expect(page).toContain("Entries / incoming");
    expect(page).toContain("Sales / outgoing");
    expect(page).toContain("Transfers");
    expect(page).toContain("max-h-[38rem]");
    expect(page).toContain("<StockMovementReversalForm");
    expect(page).toContain("<ProductManagement");
  });

  it("uses the signed-in member identity when a profile name is absent", async () => {
    const page = await readProjectFile("app/(protected)/stock/page.tsx");

    expect(page).toContain("movement.createdBy === context.user.id");
    expect(page).toContain("context.user.displayName");
    expect(page).not.toContain('movement.createdByName ?? "Employee"');
  });

  it("loads only the selected movement-history period", async () => {
    const service = await readProjectFile("services/product-stock.ts");

    expect(service).toContain('.gte("business_date", options.fromDate)');
    expect(service).toContain('.lte("business_date", options.toDate)');
    expect(service).toContain('.in("movement_type"');
    expect(service).toContain(".limit(options.limit ?? 250)");
  });

  it("exposes product stock in primary navigation", async () => {
    const navigation = await readProjectFile("lib/auth/navigation.ts");

    expect(navigation).toContain(
      '{ label: "Products & Stock", href: "/stock" }',
    );
  });

  it("keeps supplier receipts and sales for linked workflows", async () => {
    const page = await readProjectFile("app/(protected)/stock/page.tsx");
    const form = await readProjectFile("components/stock-movement-form.tsx");

    expect(form).toContain('useState<EntryType>("transfer")');
    expect(form).toContain(
      '<input name="entryType" type="hidden" value={entryType} />',
    );
    expect(page).toContain(
      "Supplier receipts and sales will post automatically",
    );
    expect(form).not.toContain('value: "supplier_receipt"');
    expect(form).not.toContain('value: "sale"');
  });
});
