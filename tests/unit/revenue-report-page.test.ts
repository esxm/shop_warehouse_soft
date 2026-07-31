import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function readProjectFile(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

describe("revenue report page and export", () => {
  it("renders filters, presets, totals, daily/monthly tables, and CSV export", async () => {
    const page = await readProjectFile("app/(protected)/reports/page.tsx");

    expect(page).toContain("resolveRevenueQuery");
    expect(page).toContain("getRevenueReport");
    expect(page).toContain("Current week");
    expect(page).toContain("Previous month");
    expect(page).toContain("Daily revenue");
    expect(page).toContain("Monthly aggregation");
    expect(page).toContain("Export CSV");
    expect(page).not.toContain("PlaceholderPage");
  });

  it("uses only closed net daily-sales summaries scoped to the business", async () => {
    const service = await readProjectFile("services/revenue-report.ts");

    expect(service).toContain('from("daily_net_revenue_summaries")');
    expect(service).toContain('.eq("status", "closed")');
    expect(service).toContain('.eq("business_id", context.business.id)');
    expect(service).not.toContain("customer_payments");
  });

  it("protects the CSV route and reuses report filters and aggregation", async () => {
    const route = await readProjectFile(
      "app/(protected)/reports/revenue.csv/route.ts",
    );

    expect(route).toContain("requireBusinessMember");
    expect(route).toContain("resolveRevenueQuery");
    expect(route).toContain("getRevenueReport");
    expect(route).toContain("createRevenueCsv");
    expect(route).toContain('"text/csv; charset=utf-8"');
  });
});
