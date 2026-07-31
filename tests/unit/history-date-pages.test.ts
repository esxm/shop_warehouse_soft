import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function readProjectFile(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

describe("operational history date filters", () => {
  it.each([
    "app/(protected)/daily-sales/page.tsx",
    "app/(protected)/expenses/page.tsx",
    "app/(protected)/returns-and-losses/page.tsx",
    "app/(protected)/suppliers/[supplierId]/page.tsx",
    "app/(protected)/stock/page.tsx",
  ])("adds a reusable period control to %s", async (path) => {
    const page = await readProjectFile(path);

    expect(page).toContain("<HistoryPeriodFilter");
    expect(page).toContain("historyPeriod.fromDate");
    expect(page).toContain("historyPeriod.toDate");
  });

  it("lets supplier payable trace history default to all dates", async () => {
    const page = await readProjectFile(
      "app/(protected)/reports/payables/[supplierId]/page.tsx",
    );

    expect(page).toContain("resolveOptionalHistoryPeriod");
    expect(page).toContain("Show all");
    expect(page).toContain("Showing all history instead.");
  });

  it.each([
    "app/(protected)/customers/[customerId]/page.tsx",
    "app/(protected)/reports/receivables/[customerId]/page.tsx",
  ])(
    "adds an inclusive period control to customer history in %s",
    async (path) => {
      const page = await readProjectFile(path);

      expect(page).toContain("<HistoryPeriodFilter");
      expect(page).toContain("historyPeriod.fromDate");
      expect(page).toContain("historyPeriod.toDate");
    },
  );

  it("defaults existing cash and audit range filters to today", async () => {
    const [cash, audit] = await Promise.all([
      readProjectFile("app/(protected)/cash-and-bank/page.tsx"),
      readProjectFile("app/(protected)/(admin)/audit-log/page.tsx"),
    ]);

    expect(cash).toContain("useDefaultHistoryDate");
    expect(audit).toContain("useDefaultHistoryDate");
  });

  it("reopens the targeted collapsible panel after period navigation", async () => {
    const panel = await readProjectFile("components/collapsible-panel.tsx");

    expect(panel).toContain("window.location.hash.slice(1) === id");
    expect(panel).toContain('window.addEventListener("hashchange"');
    expect(panel).toContain("open={isOpen}");
  });

  it("filters each operational history at its database date column", async () => {
    const services = await Promise.all([
      readProjectFile("services/daily-sales.ts"),
      readProjectFile("services/product-sales.ts"),
      readProjectFile("services/expenses.ts"),
      readProjectFile("services/inventory-value.ts"),
      readProjectFile("services/returns-and-losses.ts"),
      readProjectFile("services/customer-credit-purchases.ts"),
      readProjectFile("services/customer-payments.ts"),
      readProjectFile("services/supplier-purchases.ts"),
      readProjectFile("services/supplier-payments.ts"),
    ]);
    const source = services.join("\n");

    for (const column of [
      "business_date",
      "sale_date",
      "expense_date",
      "transfer_date",
      "return_date",
      "exception_date",
      "purchase_date",
      "payment_date",
    ]) {
      expect(source).toContain(`.gte("${column}"`);
      expect(source).toContain(`.lte("${column}"`);
    }
  });
});
