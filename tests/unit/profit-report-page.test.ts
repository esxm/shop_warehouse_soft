import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function readProjectFile(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

describe("product profit report page", () => {
  it("offers day, week, month, and custom periods", async () => {
    const page = await readProjectFile(
      "app/(protected)/reports/profit/page.tsx",
    );

    expect(page).toContain("Today");
    expect(page).toContain("Current week");
    expect(page).toContain("Current month");
    expect(page).toContain("Apply custom period");
    expect(page).toContain('title="Profit by day"');
    expect(page).toContain('title="Profit by week"');
    expect(page).toContain('title="Profit by month"');
  });

  it("shows the selected-period amount and percentage", async () => {
    const page = await readProjectFile(
      "app/(protected)/reports/profit/page.tsx",
    );

    expect(page).toContain("Selected-period profit");
    expect(page).toContain("Profit percentage");
    expect(page).toContain("report.totals.productProfitRon");
  });

  it("defines profit and distinguishes it from final net profit", async () => {
    const page = await readProjectFile(
      "app/(protected)/reports/profit/page.tsx",
    );

    expect(page).toContain("net selling revenue minus historical");
    expect(page).toContain("not final accounting net profit");
  });

  it("adds profit to report navigation", async () => {
    const navigation = await readProjectFile(
      "components/report-navigation.tsx",
    );

    expect(navigation).toContain(
      '{ href: "/reports/profit", label: "Profit" }',
    );
  });

  it("protects and validates profit CSV export", async () => {
    const route = await readProjectFile(
      "app/(protected)/reports/profit.csv/route.ts",
    );

    expect(route).toContain("requireBusinessMember()");
    expect(route).toContain("resolveRevenueQuery");
    expect(route).toContain("private, no-store");
    expect(route).toContain("createProfitCsv");
  });
});
