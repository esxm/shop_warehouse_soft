import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function readProjectFile(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

describe("cash and bank ledger page", () => {
  it("renders derived balances, daily totals, history, and filters", async () => {
    const page = await readProjectFile(
      "app/(protected)/cash-and-bank/page.tsx",
    );

    expect(page).toContain("requireBusinessMember");
    expect(page).toContain("getFinancialAccountBalances");
    expect(page).toContain("getFinancialAccountDailyTotals");
    expect(page).toContain("getFinancialAccountEntries");
    expect(page).toContain("Ledger filters");
    expect(page).not.toContain("PlaceholderPage");
  });

  it("scopes exact-decimal ledger view reads to the current business", async () => {
    const service = await readProjectFile(
      "services/financial-account-ledger.ts",
    );

    expect(service).toContain('from("financial_account_balances")');
    expect(service).toContain('from("financial_account_daily_totals")');
    expect(service).toContain('from("financial_account_entry_summaries")');
    expect(service).toContain('.eq("business_id", context.business.id)');
  });
});
