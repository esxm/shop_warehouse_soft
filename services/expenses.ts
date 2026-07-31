import "server-only";

import type { CurrentUserContext } from "@/lib/auth/types";
import { createAdminSupabaseClient } from "@/lib/db/admin";
import { createServerSupabaseClient } from "@/lib/db/server";
import type { ExpenseInput } from "@/lib/validation/expenses";

export type ExpenseCategory = Readonly<{
  id: string;
  name: string;
}>;

export type ExpenseFinancialAccount = Readonly<{
  id: string;
  name: string;
  type: "cash" | "bank";
}>;

export type Expense = Readonly<{
  id: string;
  businessDayId: string;
  expenseDate: string;
  categoryName: string;
  amountRon: string;
  financialAccountName: string;
  financialAccountType: "cash" | "bank";
  description: string;
  entryOrigin: string;
  createdAt: string;
  status: "active" | "reversed";
  reversedAt: string | null;
  reversalReason: string | null;
}>;

export type MonthlyExpenseSummary = Readonly<{
  monthStart: string;
  categoryName: string;
  expenseCount: number;
  totalRon: string;
}>;

const DEFAULT_EXPENSE_CATEGORIES = [
  "Rent",
  "Electricity",
  "Transport",
  "Salary",
  "Internet",
  "Taxes and fees",
  "Maintenance",
  "Other",
] as const;

async function ensureExpenseCategories(
  businessId: string,
  existingCategories: readonly ExpenseCategory[],
): Promise<readonly ExpenseCategory[]> {
  if (existingCategories.length > 0) {
    return existingCategories;
  }

  const adminSupabase = createAdminSupabaseClient();
  const defaultRows = DEFAULT_EXPENSE_CATEGORIES.map((name) => ({
    business_id: businessId,
    name,
  }));
  const insertResult = await adminSupabase
    .from("expense_categories")
    .insert(defaultRows)
    .select("id, name")
    .order("name");

  if (!insertResult.error) {
    return insertResult.data;
  }

  await adminSupabase
    .from("expense_categories")
    .update({ is_active: true })
    .eq("business_id", businessId)
    .in("name", [...DEFAULT_EXPENSE_CATEGORIES]);

  const { data, error } = await adminSupabase
    .from("expense_categories")
    .select("id, name")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("name");

  if (error) {
    throw new Error("Unable to load expense categories.");
  }

  return data;
}

export async function getExpensePageData(
  context: CurrentUserContext,
  period: Readonly<{ fromDate: string; toDate: string }>,
): Promise<
  Readonly<{
    categories: readonly ExpenseCategory[];
    accounts: readonly ExpenseFinancialAccount[];
    expenses: readonly Expense[];
    monthlySummaries: readonly MonthlyExpenseSummary[];
  }>
> {
  const supabase = await createServerSupabaseClient();
  const [categoryResult, accountResult, expenseResult, summaryResult] =
    await Promise.all([
      supabase
        .from("expense_categories")
        .select("id, name")
        .eq("business_id", context.business.id)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("financial_accounts")
        .select("id, name, type")
        .eq("business_id", context.business.id)
        .eq("currency", "RON")
        .eq("is_active", true)
        .order("type")
        .order("name"),
      supabase
        .from("expense_summaries")
        .select(
          "expense_id, business_day_id, expense_date, category_name, amount_ron, financial_account_name, financial_account_type, description, entry_origin, created_at, status, reversed_at, reversal_reason",
        )
        .eq("business_id", context.business.id)
        .gte("expense_date", period.fromDate)
        .lte("expense_date", period.toDate)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("monthly_expense_summaries")
        .select("month_start, category_name, expense_count, total_ron")
        .eq("business_id", context.business.id)
        .order("month_start", { ascending: false })
        .order("category_name")
        .limit(120),
    ]);

  if (
    categoryResult.error ||
    accountResult.error ||
    expenseResult.error ||
    summaryResult.error
  ) {
    throw new Error("Unable to load expenses.");
  }

  const expenses = expenseResult.data.map((row): Expense => {
    if (
      !row.expense_id ||
      !row.business_day_id ||
      !row.expense_date ||
      !row.category_name ||
      row.amount_ron === null ||
      !row.financial_account_name ||
      (row.financial_account_type !== "cash" &&
        row.financial_account_type !== "bank") ||
      !row.description ||
      !row.created_at ||
      (row.status !== "active" && row.status !== "reversed")
    ) {
      throw new Error("Expense data is incomplete.");
    }

    return {
      id: row.expense_id,
      businessDayId: row.business_day_id,
      expenseDate: row.expense_date,
      categoryName: row.category_name,
      amountRon: row.amount_ron,
      financialAccountName: row.financial_account_name,
      financialAccountType: row.financial_account_type,
      description: row.description,
      entryOrigin: row.entry_origin ?? "operational",
      createdAt: row.created_at,
      status: row.status,
      reversedAt: row.reversed_at,
      reversalReason: row.reversal_reason,
    };
  });

  const categories = await ensureExpenseCategories(
    context.business.id,
    categoryResult.data,
  );

  return {
    categories,
    accounts: accountResult.data,
    expenses,
    monthlySummaries: summaryResult.data.map((row) => {
      if (
        !row.month_start ||
        !row.category_name ||
        row.expense_count === null ||
        row.total_ron === null
      ) {
        throw new Error("Monthly expense summary is incomplete.");
      }

      return {
        monthStart: row.month_start,
        categoryName: row.category_name,
        expenseCount: row.expense_count,
        totalRon: row.total_ron,
      };
    }),
  };
}

export async function createExpense(
  context: CurrentUserContext,
  input: ExpenseInput,
): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_expense", {
    target_business_id: context.business.id,
    target_business_day_id: input.businessDayId,
    target_category_id: input.categoryId,
    target_amount_ron: input.amountRon,
    target_financial_account_id: input.financialAccountId,
    target_description: input.description,
    target_idempotency_key: input.idempotencyKey,
    target_audit_reason: input.auditReason ?? undefined,
  });

  if (error || !data) {
    if (error?.message.includes("Historical expenses require")) {
      throw new Error("Enter an audit reason for a closed business day.");
    }

    if (error?.message.includes("current open business day")) {
      throw new Error("Employees can record expenses only on the open day.");
    }

    throw new Error("Expense could not be recorded.");
  }

  return data;
}

export async function reverseExpense(
  context: CurrentUserContext,
  expenseId: string,
  reason: string,
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("reverse_expense", {
    target_business_id: context.business.id,
    target_expense_id: expenseId,
    target_reason: reason,
  });

  if (error) {
    throw new Error(
      error.message.includes("already reversed")
        ? "This expense is already reversed."
        : "Expense could not be reversed.",
    );
  }
}
