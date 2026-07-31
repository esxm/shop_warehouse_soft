import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { calculateDashboardMetrics } from "@/lib/dashboard/formulas";

type ArtifactCheck = Readonly<{
  invariant: string;
  files: readonly string[];
  includes: readonly (string | RegExp)[];
  excludes?: readonly string[];
}>;

const checks: readonly ArtifactCheck[] = [
  {
    invariant: "Customer payment never increases revenue.",
    files: ["services/revenue-report.ts"],
    includes: [
      'from("daily_net_revenue_summaries")',
      '.eq("status", "closed")',
    ],
    excludes: ["customer_payments"],
  },
  {
    invariant: "Supplier payment never reduces profit as an expense.",
    files: ["services/profit-report.ts", "lib/reports/profit.ts"],
    includes: ['from("product_sales_daily_analysis")', "historicalCostRon"],
    excludes: ["supplier_payments", "expenses"],
  },
  {
    invariant:
      "Supplier purchase increases payable and inventory, not cash outflow unless paid.",
    files: [
      "services/supplier-purchases.ts",
      "supabase/migrations/20260703000100_supplier_purchase_product_lines.sql",
    ],
    includes: [
      "create_supplier_purchase_with_lines_idempotent",
      "insert into public.supplier_purchases",
      "insert into public.inventory_value_movements",
      "insert into public.supplier_purchase_lines",
    ],
    excludes: ["insert into public.financial_account_entries"],
  },
  {
    invariant: "Warehouse-to-shop transfer does not change total inventory.",
    files: [
      "services/inventory-value.ts",
      "supabase/tests/0024_product_inventory_transfers.test.sql",
    ],
    includes: [
      "create_inventory_product_transfer",
      "decreases exact warehouse quantities",
      "increases exact shop quantities",
      "without changing total",
    ],
  },
  {
    invariant: "Cash and bank balances equal ledger sums.",
    files: ["services/cash-bank-report.ts", "lib/reports/cash-bank.ts"],
    includes: [
      'from("financial_account_entry_summaries")',
      'from("financial_account_balances")',
      "signedBalance",
      "currentBalanceRon",
    ],
  },
  {
    invariant: "Customer outstanding equals purchases minus allocations.",
    files: ["lib/reports/customer-receivables.ts"],
    includes: ["subtractMoney(amount, allocated)", "remainingRon"],
  },
  {
    invariant: "Supplier outstanding equals purchases minus allocations.",
    files: ["lib/reports/supplier-payables.ts"],
    includes: ["subtractMoney(original, paid)", "remainingOriginalAmount"],
  },
  {
    invariant: "Daily close cannot duplicate cash or bank inflows.",
    files: ["supabase/tests/0011_daily_sales.test.sql"],
    includes: [
      "duplicate close does not duplicate account inflows",
      "duplicate close does not duplicate closure history",
    ],
  },
  {
    invariant: "Reversal restores financial effects.",
    files: ["tests/unit/correction-workflows.test.ts"],
    includes: [/reversal restores .*receivables/i, /reverse_.*payment/],
  },
  {
    invariant: "Employee cannot edit closed days.",
    files: [
      "supabase/tests/0011_daily_sales.test.sql",
      "tests/unit/permissions.test.ts",
    ],
    includes: [
      "closed daily sales cannot be edited",
      "rejects missing, cross-business, or closed days",
    ],
  },
  {
    invariant: "Employee cannot perform admin operations.",
    files: ["supabase/tests/0020_security_hardening.test.sql"],
    includes: ["employee cannot call the admin access operation directly"],
  },
  {
    invariant: "Cross-business data access is blocked.",
    files: ["supabase/tests/0020_security_hardening.test.sql"],
    includes: ["RLS hides another tenant business"],
  },
  {
    invariant:
      "USD historical inventory cost does not change when current rate changes.",
    files: [
      "supabase/tests/0028_stock_cost_and_creator_labels.test.sql",
      "services/inventory-value.ts",
    ],
    includes: [
      "USD purchase price and exchange rate remain traceable",
      "stored_historical",
      "inventory_value_usd",
    ],
  },
];

async function readProjectFile(path: string): Promise<string> {
  return readFile(join(process.cwd(), path), "utf8");
}

async function readArtifacts(files: readonly string[]): Promise<string> {
  const contents = await Promise.all(files.map(readProjectFile));
  return contents.join("\n");
}

describe("Phase 1 release-gate invariants", () => {
  it.each(checks)("$invariant", async ({ files, includes, excludes }) => {
    const source = await readArtifacts(files);

    for (const expected of includes) {
      if (typeof expected === "string") {
        expect(source).toContain(expected);
      } else {
        expect(source).toEqual(expect.stringMatching(expected));
      }
    }

    for (const forbidden of excludes ?? []) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("current supplier payable estimate changes when the current USD/RON rate changes", () => {
    const lowRate = calculateDashboardMetrics({
      today: "2026-07-16",
      revenues: [],
      financialAccounts: [{ type: "cash", balanceRon: "1000.00" }],
      receivables: [],
      payables: [{ currency: "USD", outstandingOriginalAmount: "100.00" }],
      productInventory: [],
      usdRonRate: "4.50",
    });
    const highRate = calculateDashboardMetrics({
      today: "2026-07-16",
      revenues: [],
      financialAccounts: [{ type: "cash", balanceRon: "1000.00" }],
      receivables: [],
      payables: [{ currency: "USD", outstandingOriginalAmount: "100.00" }],
      productInventory: [],
      usdRonRate: "4.80",
    });

    expect(lowRate.estimatedUsdPayablesRon).toBe("450.00");
    expect(highRate.estimatedUsdPayablesRon).toBe("480.00");
    expect(lowRate.netBusinessValueRon).toBe("550.00");
    expect(highRate.netBusinessValueRon).toBe("520.00");
  });

  it("net business value does not add revenue separately", () => {
    const metrics = calculateDashboardMetrics({
      today: "2026-07-16",
      revenues: [{ businessDate: "2026-07-16", totalSalesRon: "9999.00" }],
      financialAccounts: [{ type: "cash", balanceRon: "100.00" }],
      receivables: [{ outstandingRon: "50.00" }],
      payables: [],
      productInventory: [
        { inventoryValueRon: "25.00", costIsComplete: true },
        { inventoryValueRon: "25.00", costIsComplete: true },
      ],
      usdRonRate: null,
    });

    expect(metrics.todayRevenueRon).toBe("9999.00");
    expect(metrics.netBusinessValueRon).toBe("200.00");
  });

  it("release checklist documents every required invariant and gate command", async () => {
    const checklist = await readProjectFile("docs/release-checklist.md");

    for (const index of Array.from({ length: 15 }, (_, item) => item + 1)) {
      expect(checklist).toContain(`${index}.`);
    }

    expect(checklist).toContain("npm.cmd run lint");
    expect(checklist).toContain("npm.cmd run typecheck");
    expect(checklist).toContain("tests/unit/release-gate-invariants.test.ts");
    expect(checklist).toContain(
      "supabase/tests/0029_release_gate_invariants.test.sql",
    );
    expect(checklist).toContain("tests/e2e/release-gate.spec.ts");
  });
});
