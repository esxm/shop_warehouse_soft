import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function readProjectFile(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

describe("Step 25 idempotency and concurrency wiring", () => {
  it("sends request identifiers for both purchase commands", async () => {
    const [customerForm, supplierForm] = await Promise.all([
      readProjectFile("components/customer-credit-purchase-form.tsx"),
      readProjectFile("components/supplier-purchase-form.tsx"),
    ]);

    expect(customerForm).toContain('name="idempotencyKey"');
    expect(supplierForm).toContain('name="idempotencyKey"');
  });

  it("routes purchase writes through protected database commands", async () => {
    const [customerService, supplierService] = await Promise.all([
      readProjectFile("services/customer-credit-purchases.ts"),
      readProjectFile("services/supplier-purchases.ts"),
    ]);

    expect(customerService).toContain(
      '"create_customer_credit_purchase_idempotent"',
    );
    expect(supplierService).toContain('"create_supplier_purchase_idempotent"');
  });

  it("serializes duplicate purchase requests and fingerprints their data", async () => {
    const migration = await readProjectFile(
      "supabase/migrations/20260702000700_step_25_idempotent_purchases.sql",
    );

    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("request_fingerprint");
    expect(migration).toContain("reused with different data");
    expect(migration).toContain("private.financial_command_idempotency");
  });

  it("documents every covered financial command", async () => {
    const documentation = await readProjectFile(
      "docs/idempotency-and-concurrency.md",
    );

    for (const command of [
      "Customer payments",
      "Supplier payments",
      "Supplier purchases",
      "Daily sales close",
      "Expenses",
      "Inventory transfers",
      "Stocktakes",
      "Reversals",
    ]) {
      expect(documentation).toContain(command);
    }
  });
});
