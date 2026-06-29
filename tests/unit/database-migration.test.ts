import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260629000100_database_foundation.sql",
);

let migration = "";

beforeAll(async () => {
  migration = await readFile(migrationPath, "utf8");
});

describe("database foundation migration", () => {
  it.each([
    "businesses",
    "profiles",
    "business_members",
    "inventory_locations",
    "financial_accounts",
    "audit_logs",
  ])("creates and enables RLS on %s", (table) => {
    expect(migration).toContain(`create table public.${table}`);
    expect(migration).toContain(
      `alter table public.${table} enable row level security`,
    );
  });

  it("keeps membership helpers out of the exposed public schema", () => {
    expect(migration).toContain("create schema if not exists private");
    expect(migration).toContain("create function private.is_business_member");
    expect(migration).toContain("create function private.is_business_admin");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
  });

  it("does not grant foundation table access to anonymous requests", () => {
    expect(migration).not.toMatch(
      /grant\s+(?:select|insert|update|delete|all)[\s\S]*?\s+to\s+anon\b/i,
    );
  });

  it("enforces one Phase 1 location and account of each type", () => {
    expect(migration).toContain(
      "constraint inventory_locations_business_type_key unique (business_id, type)",
    );
    expect(migration).toContain(
      "constraint financial_accounts_business_type_key unique (business_id, type)",
    );
  });

  it("bootstraps all required records in one database function", () => {
    expect(migration).toContain(
      "create function public.create_business_foundation",
    );
    expect(migration).toContain("(new_business_id, 'Warehouse', 'warehouse')");
    expect(migration).toContain("(new_business_id, 'Shop', 'shop')");
    expect(migration).toContain("(new_business_id, 'Cash Register', 'cash')");
    expect(migration).toContain("(new_business_id, 'Bank Account', 'bank')");
    expect(migration).toContain("'business.foundation_created'");
  });
});
