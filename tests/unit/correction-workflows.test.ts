import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function readProjectFile(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

const reversalCases = [
  {
    label: "customer credit purchase",
    file: "supabase/migrations/20260701000300_customer_credit_purchases.sql",
    testFile: "supabase/tests/0005_customer_credit_purchases.test.sql",
    functionName: "reverse_customer_credit_purchase",
    action: "customer_credit_purchase.reversed",
    compensation: "update public.customer_credit_purchases",
    effectTest: "reversal preserves and marks the original purchase",
    auditTest: "successful reversal is audited once",
  },
  {
    label: "customer payment",
    file: "supabase/migrations/20260701000400_customer_payments.sql",
    testFile: "supabase/tests/0006_customer_payments.test.sql",
    functionName: "reverse_customer_payment",
    action: "customer_payment.reversed",
    compensation: "customer_payment_reversal",
    effectTest: "payment reversal restores receivables",
    auditTest: "successful payment reversal is audited once",
  },
  {
    label: "supplier purchase",
    file: "supabase/migrations/20260701000600_supplier_purchases.sql",
    testFile: "supabase/tests/0008_supplier_purchases.test.sql",
    functionName: "reverse_supplier_purchase",
    action: "supplier_purchase.reversed",
    compensation: "supplier_purchase_reversal",
    effectTest: "reversal creates one linked compensating warehouse outflow",
    auditTest: "supplier purchase reversal is audited with its reason",
  },
  {
    label: "supplier payment",
    file: "supabase/migrations/20260701000700_supplier_payments.sql",
    testFile: "supabase/tests/0009_supplier_payments.test.sql",
    functionName: "reverse_supplier_payment",
    action: "supplier_payment.reversed",
    compensation: "supplier_payment_reversal",
    effectTest: "reversal restores allocations to supplier payable",
    auditTest: "supplier payment reversal is audited with reason",
  },
  {
    label: "expense",
    file: "supabase/migrations/20260701001000_expenses.sql",
    testFile: "supabase/tests/0012_expenses.test.sql",
    functionName: "reverse_expense",
    action: "expense.reversed",
    compensation: "expense_reversal",
    effectTest: "reversal restores the original expense amount to the account",
    auditTest: "expense reversal records the administrator and reason",
  },
  {
    label: "inventory transfer",
    file: "supabase/migrations/20260701001100_inventory_value_transfers.sql",
    testFile: "supabase/tests/0013_inventory_value_transfers.test.sql",
    functionName: "reverse_inventory_value_transfer",
    action: "inventory_transfer.reversed",
    compensation: "inventory_transfer_reversal",
    effectTest: "reversal restores warehouse value",
    auditTest: "transfer reversal records the administrator and reason",
  },
] as const;

describe.each(reversalCases)("$label correction contract", (testCase) => {
  it("authorizes, locks, blocks duplicates, compensates, preserves, and audits atomically", async () => {
    const migration = await readProjectFile(testCase.file);
    const start = migration.indexOf(
      `create function public.${testCase.functionName}`,
    );
    const end = migration.indexOf(
      `revoke all on function public.${testCase.functionName}`,
      start,
    );
    const reversal = migration.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(reversal).toContain("private.is_business_admin");
    expect(reversal).toMatch(
      /char_length\(normalized_reason\)[\s\S]*10[\s\S]*500/,
    );
    expect(reversal).toMatch(/for update|reversal_of_id/);
    expect(reversal).toContain("already reversed");
    expect(reversal).toContain(testCase.compensation);
    expect(reversal).toContain("insert into public.audit_logs");
    expect(reversal).toContain(testCase.action);
    expect(reversal).toContain("normalized_reason");
  });

  it("has database coverage for effects, identity/reason auditing, and duplicate rejection", async () => {
    const databaseTest = await readProjectFile(testCase.testFile);

    expect(databaseTest).toContain(testCase.effectTest);
    expect(databaseTest).toContain(testCase.auditTest);
    expect(databaseTest).toContain("already reversed");
  });
});

it("shares reversal reason validation and presentation across all six workflows", async () => {
  const validationFiles = [
    "customer-credit-purchases.ts",
    "customer-payments.ts",
    "supplier-purchases.ts",
    "supplier-payments.ts",
    "expenses.ts",
    "inventory-transfers.ts",
  ];
  const componentFiles = [
    "customer-credit-purchase-reversal-form.tsx",
    "customer-payment-reversal-form.tsx",
    "supplier-purchase-reversal-form.tsx",
    "supplier-payment-reversal-form.tsx",
    "expense-reversal-form.tsx",
    "inventory-transfer-reversal-form.tsx",
  ];

  for (const file of validationFiles) {
    const source = await readProjectFile(`lib/validation/${file}`);
    expect(source).toContain("reversalReasonSchema");
    expect(source).toContain("reversalConfirmationSchema");
  }

  for (const file of componentFiles) {
    const source = await readProjectFile(`components/${file}`);
    expect(source).toContain("ReversalForm");
  }
});
