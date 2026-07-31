import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function readProjectFile(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

describe("supplier payables report routes", () => {
  it("renders currency-separated summary, filters, rate, table, and export", async () => {
    const page = await readProjectFile(
      "app/(protected)/reports/payables/page.tsx",
    );

    expect(page).toContain("getSupplierPayablesPageData");
    expect(page).toContain("RON payables");
    expect(page).toContain("USD payables");
    expect(page).toContain("Estimated total RON");
    expect(page).toContain("Manual current USD/RON reference rate");
    expect(page).toContain("Leave due dates empty to include every purchase");
    expect(page).toContain("Outstanding");
    expect(page).toContain("Trace balance");
    expect(page).toContain("Export CSV");
  });

  it("renders historical and current values plus bidirectional allocation traces", async () => {
    const page = await readProjectFile(
      "app/(protected)/reports/payables/[supplierId]/page.tsx",
    );

    expect(page).toContain("getSupplierPurchases");
    expect(page).toContain("getSupplierPayments");
    expect(page).toContain("Historical rate");
    expect(page).toContain("Historical inventory cost");
    expect(page).toContain("Payment rate");
    expect(page).toContain("outstanding to pay");
    expect(page).toContain("No purchases were recorded {historyScope}");
    expect(page).toContain("No payments were recorded {historyScope}");
    expect(page).toContain("Currency result (+ gain / - loss)");
    expect(page).toContain("formatSignedRON");
    expect(page).toContain("Payment allocation trace");
    expect(page).toContain("#supplier-purchase-");
  });

  it("protects CSV export and reuses report filters and data", async () => {
    const route = await readProjectFile(
      "app/(protected)/reports/payables.csv/route.ts",
    );

    expect(route).toContain("requireBusinessMember");
    expect(route).toContain("supplierPayablesFilterSchema");
    expect(route).toContain("getSupplierPayablesPageData");
    expect(route).toContain("createSupplierPayablesCsv");
    expect(route).toContain('"text/csv; charset=utf-8"');
  });
});
