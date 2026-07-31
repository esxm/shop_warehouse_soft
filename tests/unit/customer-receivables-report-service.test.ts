import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function readProjectFile(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

describe("customer receivables report service", () => {
  it("uses allocation-aware exact-decimal views scoped to the current business", async () => {
    const service = await readProjectFile(
      "services/customer-receivables-report.ts",
    );

    expect(service).toContain('from("customer_credit_purchase_balances")');
    expect(service).toContain('from("customers")');
    expect(service).toContain('.eq("business_id", context.business.id)');
    expect(service).toContain("buildCustomerReceivablesReport");
    expect(service).not.toContain('from("customer_payments")');
  });

  it("pushes customer and purchase-date scope into the database query", async () => {
    const service = await readProjectFile(
      "services/customer-receivables-report.ts",
    );

    expect(service).toContain('.eq("customer_id", filter.customerId)');
    expect(service).toContain('.gte("purchase_date", filter.fromDate)');
    expect(service).toContain('.lte("purchase_date", filter.toDate)');
  });
});
