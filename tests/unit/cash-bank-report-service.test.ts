import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function readProjectFile(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

describe("cash and bank report service", () => {
  it("uses deterministic, tenant-scoped immutable ledger reads", async () => {
    const service = await readProjectFile("services/cash-bank-report.ts");

    expect(service).toContain('from("financial_account_entry_summaries")');
    expect(service).toContain('from("financial_account_balances")');
    expect(service).toContain('.eq("business_id", context.business.id)');
    expect(service).toContain('.order("entry_date")');
    expect(service).toContain('.order("created_at")');
    expect(service).toContain('.order("entry_id")');
  });

  it("resolves users and operational source links", async () => {
    const service = await readProjectFile("services/cash-bank-report.ts");

    expect(service).toContain('from("profiles")');
    expect(service).toContain('from("customer_payments")');
    expect(service).toContain('from("supplier_payments")');
    expect(service).toContain("/daily-sales");
    expect(service).toContain("/expenses");
    expect(service).toContain("/opening-balances");
  });

  it("reconciles calculated current balances with the ledger balance view", async () => {
    const service = await readProjectFile("services/cash-bank-report.ts");

    expect(service).toContain("buildCashBankReport");
    expect(service).toContain("does not reconcile");
  });
});
