import "server-only";

import type { CurrentUserContext } from "@/lib/auth/types";
import { createServerSupabaseClient } from "@/lib/db/server";
import type { FinancialAccountLedgerFilter } from "@/lib/validation/financial-account-ledger";

export type FinancialAccountBalance = Readonly<{
  id: string;
  name: string;
  type: "cash" | "bank";
  balanceRon: string;
}>;

export type FinancialAccountDailyTotal = Readonly<{
  financialAccountId: string;
  financialAccountName: string;
  financialAccountType: "cash" | "bank";
  entryDate: string;
  inflowRon: string;
  outflowRon: string;
  netMovementRon: string;
  entryCount: number;
}>;

export type FinancialAccountEntry = Readonly<{
  id: string;
  financialAccountId: string;
  financialAccountName: string;
  financialAccountType: "cash" | "bank";
  businessDayId: string | null;
  entryDate: string;
  direction: "inflow" | "outflow";
  amountRon: string;
  signedAmountRon: string;
  entryType: string;
  sourceEntityType: string;
  sourceEntityId: string;
  description: string | null;
  createdAt: string;
  reversalOfId: string | null;
  idempotencyKey: string | null;
}>;

export async function getFinancialAccountBalances(
  context: CurrentUserContext,
): Promise<readonly FinancialAccountBalance[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("financial_account_balances")
    .select("financial_account_id, name, type, balance_ron")
    .eq("business_id", context.business.id)
    .order("type");

  if (error) {
    throw new Error("Unable to load financial account balances.");
  }

  return data.map((row) => {
    if (
      !row.financial_account_id ||
      !row.name ||
      !row.type ||
      row.balance_ron === null
    ) {
      throw new Error("Financial account balance data is incomplete.");
    }

    return {
      id: row.financial_account_id,
      name: row.name,
      type: row.type,
      balanceRon: row.balance_ron,
    };
  });
}

export async function getFinancialAccountDailyTotals(
  context: CurrentUserContext,
  filter: FinancialAccountLedgerFilter,
  limit = 100,
): Promise<readonly FinancialAccountDailyTotal[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("financial_account_daily_totals")
    .select(
      "financial_account_id, financial_account_name, financial_account_type, entry_date, inflow_ron, outflow_ron, net_movement_ron, entry_count",
    )
    .eq("business_id", context.business.id)
    .order("entry_date", { ascending: false })
    .order("financial_account_type")
    .limit(limit);

  if (filter.accountId) {
    query = query.eq("financial_account_id", filter.accountId);
  }

  if (filter.fromDate) {
    query = query.gte("entry_date", filter.fromDate);
  }

  if (filter.toDate) {
    query = query.lte("entry_date", filter.toDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error("Unable to load daily account totals.");
  }

  return data.map((row) => {
    if (
      !row.financial_account_id ||
      !row.financial_account_name ||
      !row.financial_account_type ||
      !row.entry_date ||
      row.inflow_ron === null ||
      row.outflow_ron === null ||
      row.net_movement_ron === null ||
      row.entry_count === null
    ) {
      throw new Error("Daily account total data is incomplete.");
    }

    return {
      financialAccountId: row.financial_account_id,
      financialAccountName: row.financial_account_name,
      financialAccountType: row.financial_account_type,
      entryDate: row.entry_date,
      inflowRon: row.inflow_ron,
      outflowRon: row.outflow_ron,
      netMovementRon: row.net_movement_ron,
      entryCount: row.entry_count,
    };
  });
}

export async function getFinancialAccountEntries(
  context: CurrentUserContext,
  filter: FinancialAccountLedgerFilter,
  limit = 200,
): Promise<readonly FinancialAccountEntry[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("financial_account_entry_summaries")
    .select(
      "entry_id, financial_account_id, financial_account_name, financial_account_type, business_day_id, entry_date, direction, amount_ron, signed_amount_ron, entry_type, source_entity_type, source_entity_id, description, created_at, reversal_of_id, idempotency_key",
    )
    .eq("business_id", context.business.id)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filter.accountId) {
    query = query.eq("financial_account_id", filter.accountId);
  }

  if (filter.fromDate) {
    query = query.gte("entry_date", filter.fromDate);
  }

  if (filter.toDate) {
    query = query.lte("entry_date", filter.toDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error("Unable to load financial account history.");
  }

  return data.map((row) => {
    if (
      !row.entry_id ||
      !row.financial_account_id ||
      !row.financial_account_name ||
      !row.financial_account_type ||
      !row.entry_date ||
      !row.direction ||
      !row.amount_ron ||
      !row.signed_amount_ron ||
      !row.entry_type ||
      !row.source_entity_type ||
      !row.source_entity_id ||
      !row.created_at
    ) {
      throw new Error("Financial account entry data is incomplete.");
    }

    return {
      id: row.entry_id,
      financialAccountId: row.financial_account_id,
      financialAccountName: row.financial_account_name,
      financialAccountType: row.financial_account_type,
      businessDayId: row.business_day_id,
      entryDate: row.entry_date,
      direction: row.direction,
      amountRon: row.amount_ron,
      signedAmountRon: row.signed_amount_ron,
      entryType: row.entry_type,
      sourceEntityType: row.source_entity_type,
      sourceEntityId: row.source_entity_id,
      description: row.description,
      createdAt: row.created_at,
      reversalOfId: row.reversal_of_id,
      idempotencyKey: row.idempotency_key,
    };
  });
}
