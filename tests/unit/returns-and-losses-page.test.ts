import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function readProjectFile(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

describe("returns and losses interface", () => {
  it("uses an administrator-only route and actions", async () => {
    const page = await readProjectFile(
      "app/(protected)/returns-and-losses/page.tsx",
    );
    const actions = await readProjectFile(
      "app/(protected)/returns-and-losses/actions.ts",
    );
    const navigation = await readProjectFile("lib/auth/navigation.ts");

    expect(page).toContain("requireAdmin()");
    expect(actions.split("requireAdmin()")).toHaveLength(5);
    expect(navigation).toContain('href: "/returns-and-losses"');
    expect(navigation).toContain('pathname === "/returns-and-losses"');
  });

  it("offers sale-linked refund and stock-disposition controls", async () => {
    const form = await readProjectFile("components/sale-return-form.tsx");

    expect(form).toContain("Original sale");
    expect(form).toContain("Sellable stock");
    expect(form).toContain("Damaged stock");
    expect(form).toContain("Cash refund (RON)");
    expect(form).toContain("Cancel customer credit (RON)");
  });

  it("offers damage, missing, and stolen stock events", async () => {
    const form = await readProjectFile(
      "components/inventory-exception-form.tsx",
    );

    expect(form).toContain('value="damage"');
    expect(form).toContain('value="missing"');
    expect(form).toContain('value="stolen"');
    expect(form).toContain("estimated inventory reduction");
  });

  it("shows damaged balances and immutable histories with reversals", async () => {
    const page = await readProjectFile(
      "app/(protected)/returns-and-losses/page.tsx",
    );

    expect(page).toContain("Damaged stock currently held");
    expect(page).toContain("Customer return history");
    expect(page).toContain("Inventory exception history");
    expect(page).toContain("<Step36ReversalForm");
  });

  it("revalidates every linked financial and inventory screen", async () => {
    const actions = await readProjectFile(
      "app/(protected)/returns-and-losses/actions.ts",
    );

    for (const path of [
      "/daily-sales",
      "/stock",
      "/inventory-value",
      "/customers",
      "/cash-and-bank",
      "/reports",
    ]) {
      expect(actions).toContain(`revalidatePath("${path}")`);
    }
  });

  it("uses return-adjusted revenue on reports and dashboard", async () => {
    const revenue = await readProjectFile("services/revenue-report.ts");
    const dashboard = await readProjectFile("services/dashboard.ts");

    expect(revenue).toContain('from("daily_net_revenue_summaries")');
    expect(dashboard).toContain('from("daily_net_revenue_summaries")');
  });
});
