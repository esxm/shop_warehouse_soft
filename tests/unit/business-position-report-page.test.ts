import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function readProjectFile(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

describe("business-position report page", () => {
  it("shows all components, exact formula, transparent rate, and trend", async () => {
    const page = await readProjectFile(
      "app/(protected)/reports/business-position/page.tsx",
    );

    expect(page).toContain("Warehouse inventory");
    expect(page).toContain("Shop inventory");
    expect(page).toContain("Customer receivables");
    expect(page).toContain("Supplier payables");
    expect(page).toContain("Exact calculation");
    expect(page).toContain("Revenue is deliberately absent");
    expect(page).toContain("Historical snapshot trend");
    expect(page).toContain("Net-worth change is not exact profit");
  });

  it("protects snapshot writes with an admin server action", async () => {
    const action = await readProjectFile(
      "app/(protected)/reports/business-position/actions.ts",
    );
    const migration = await readProjectFile(
      "supabase/migrations/20260702000100_business_position_snapshots.sql",
    );

    expect(action).toContain("requireAdmin");
    expect(action).toContain("businessPositionSnapshotSchema");
    expect(migration).toContain("private.is_business_admin");
    expect(migration).toContain("business_position_snapshots_prevent_mutation");
    expect(migration).toContain(
      "Snapshot date must be the current business date",
    );
  });
});
