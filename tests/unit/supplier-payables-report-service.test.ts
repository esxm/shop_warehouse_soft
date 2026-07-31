import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function readProjectFile(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

describe("supplier payables report service", () => {
  it("uses allocation-aware purchases and the latest effective manual rate", async () => {
    const service = await readProjectFile(
      "services/supplier-payables-report.ts",
    );

    expect(service).toContain('from("supplier_purchase_summaries")');
    expect(service).toContain('from("currency_reference_rate_summaries")');
    expect(service).toContain('.eq("business_id", context.business.id)');
    expect(service).toContain('.lte("effective_date", asOfDate)');
    expect(service).toContain("buildSupplierPayablesReport");
  });

  it("pushes supplier, currency, and due-date scope into the query", async () => {
    const service = await readProjectFile(
      "services/supplier-payables-report.ts",
    );

    expect(service).toContain('.eq("supplier_id", filter.supplierId)');
    expect(service).toContain('.eq("currency", filter.currency)');
    expect(service).toContain('.gte("due_date", filter.dueFromDate)');
    expect(service).toContain('.lte("due_date", filter.dueToDate)');
  });
});
