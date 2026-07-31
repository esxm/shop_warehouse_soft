import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function readProjectFile(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

describe("audit-log interface", () => {
  it("is admin-only and exposes every required filter and safe data view", async () => {
    const page = await readProjectFile(
      "app/(protected)/(admin)/audit-log/page.tsx",
    );

    expect(page).toContain("requireAdmin");
    expect(page).toContain('name="userId"');
    expect(page).toContain('name="action"');
    expect(page).toContain('name="entityType"');
    expect(page).toContain('name="fromDate"');
    expect(page).toContain('name="toDate"');
    expect(page).toContain("formatAuditData");
    expect(page).toContain("Before");
    expect(page).toContain("After");
    expect(page).toContain("Open affected record");
  });

  it("uses the RLS read model, tenant scope, filter pushdown, and record links", async () => {
    const service = await readProjectFile("services/audit-log.ts");

    expect(service).toContain('from("audit_log_summaries")');
    expect(service).toContain('.eq("business_id", context.business.id)');
    expect(service).toContain('.eq("actor_user_id", filter.userId)');
    expect(service).toContain('.eq("action", filter.action)');
    expect(service).toContain('.eq("entity_type", filter.entityType)');
    expect(service).toContain('.gte("business_date", filter.fromDate)');
    expect(service).toContain('.lte("business_date", filter.toDate)');
    expect(service).toContain("#customer-credit-purchase-");
    expect(service).toContain("#supplier-payment-");
    expect(service).toContain("#inventory-transfer-");
  });
});
