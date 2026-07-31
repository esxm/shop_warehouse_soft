import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function readProjectFile(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

describe("customer receivables report routes", () => {
  it("renders summary cards, filters, balances, and CSV export", async () => {
    const page = await readProjectFile(
      "app/(protected)/reports/receivables/page.tsx",
    );

    expect(page).toContain("getCustomerReceivablesPageData");
    expect(page).toContain("Outstanding receivables");
    expect(page).toContain("Customers owing");
    expect(page).toContain("Overdue amount");
    expect(page).toContain("Outstanding only");
    expect(page).toContain("Trace balance");
    expect(page).toContain("Export CSV");
  });

  it("renders bidirectional drill-down traces and reversed history", async () => {
    const page = await readProjectFile(
      "app/(protected)/reports/receivables/[customerId]/page.tsx",
    );

    expect(page).toContain("getCustomerCreditPurchases");
    expect(page).toContain("getCustomerPayments");
    expect(page).toContain("Allocation trace");
    expect(page).toContain("Allocated purchases");
    expect(page).toContain("Reversed payments remain visible");
    expect(page).toContain("#purchase-");
  });

  it("protects CSV export and reuses the page report and filters", async () => {
    const route = await readProjectFile(
      "app/(protected)/reports/receivables.csv/route.ts",
    );

    expect(route).toContain("requireBusinessMember");
    expect(route).toContain("customerReceivablesFilterSchema");
    expect(route).toContain("getCustomerReceivablesPageData");
    expect(route).toContain("createCustomerReceivablesCsv");
    expect(route).toContain('"text/csv; charset=utf-8"');
  });
});
