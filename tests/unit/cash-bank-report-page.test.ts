import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function readProjectFile(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

describe("cash and bank report routes", () => {
  it("renders separate accounts, required balances, filters, and ledger columns", async () => {
    const page = await readProjectFile(
      "app/(protected)/reports/cash-and-bank/page.tsx",
    );

    expect(page).toContain("getCashBankReportPageData");
    expect(page).toContain("Opening balance");
    expect(page).toContain("Selected inflows");
    expect(page).toContain("Selected outflows");
    expect(page).toContain("Current balance");
    expect(page).toContain("Transaction type");
    expect(page).toContain("Running balance");
    expect(page).toContain("Open source");
    expect(page).toContain("Export CSV");
  });

  it("protects CSV export and reuses report filters and calculations", async () => {
    const route = await readProjectFile(
      "app/(protected)/reports/cash-and-bank.csv/route.ts",
    );

    expect(route).toContain("requireBusinessMember");
    expect(route).toContain("cashBankReportFilterSchema");
    expect(route).toContain("getCashBankReportPageData");
    expect(route).toContain("createCashBankReportCsv");
    expect(route).toContain('"text/csv; charset=utf-8"');
  });
});
