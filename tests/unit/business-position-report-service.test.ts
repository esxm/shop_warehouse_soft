import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function readProjectFile(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

describe("business-position report service", () => {
  it("loads every current balance component and rate history by business", async () => {
    const service = await readProjectFile(
      "services/business-position-report.ts",
    );

    expect(service).toContain('from("inventory_location_balances")');
    expect(service).toContain('from("financial_account_balances")');
    expect(service).toContain('from("customer_receivable_balances")');
    expect(service).toContain('from("supplier_payable_balances")');
    expect(service).toContain('from("currency_reference_rate_summaries")');
    expect(service).toContain('.eq("business_id", context.business.id)');
    expect(service).toContain("buildBusinessPosition");
  });

  it("loads immutable snapshot history and saves through the authorized RPC", async () => {
    const service = await readProjectFile(
      "services/business-position-report.ts",
    );

    expect(service).toContain('from("business_position_snapshot_summaries")');
    expect(service).toContain("buildBusinessPositionTrend");
    expect(service).toContain('"save_business_position_snapshot"');
    expect(service).toContain("target_business_id: context.business.id");
  });
});
