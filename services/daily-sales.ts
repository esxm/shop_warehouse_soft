import "server-only";

import type { CurrentUserContext } from "@/lib/auth/types";
import { createServerSupabaseClient } from "@/lib/db/server";
import type { DailySalesDraftInput } from "@/lib/validation/daily-sales";

export type DailySales = Readonly<{
  id: string;
  businessDayId: string;
  businessDate: string;
  cashSalesRon: string;
  bankSalesRon: string;
  creditSalesRon: string;
  totalSalesRon: string;
  status: "draft" | "closed";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lastDraftBy: string | null;
  lastDraftByName: string | null;
  lastDraftAt: string | null;
  closedAt: string | null;
  activeClosureId: string | null;
  closeSequence: number;
}>;

type DailySalesRow = Readonly<{
  daily_sales_id: string | null;
  business_day_id: string | null;
  business_date: string | null;
  cash_sales_ron: string | null;
  bank_sales_ron: string | null;
  credit_sales_ron: string | null;
  total_sales_ron: string | null;
  status: "draft" | "closed" | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_draft_by: string | null;
  last_draft_by_name: string | null;
  last_draft_at: string | null;
  closed_at: string | null;
  active_closure_id: string | null;
  close_sequence: number | null;
}>;

function mapDailySales(row: DailySalesRow): DailySales {
  if (
    !row.daily_sales_id ||
    !row.business_day_id ||
    !row.business_date ||
    row.cash_sales_ron === null ||
    row.bank_sales_ron === null ||
    row.credit_sales_ron === null ||
    row.total_sales_ron === null ||
    !row.status ||
    !row.created_at ||
    !row.updated_at ||
    row.close_sequence === null
  ) {
    throw new Error("Daily sales data is incomplete.");
  }

  return {
    id: row.daily_sales_id,
    businessDayId: row.business_day_id,
    businessDate: row.business_date,
    cashSalesRon: row.cash_sales_ron,
    bankSalesRon: row.bank_sales_ron,
    creditSalesRon: row.credit_sales_ron,
    totalSalesRon: row.total_sales_ron,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastDraftBy: row.last_draft_by,
    lastDraftByName: row.last_draft_by_name ?? row.last_draft_by,
    lastDraftAt: row.last_draft_at,
    closedAt: row.closed_at,
    activeClosureId: row.active_closure_id,
    closeSequence: row.close_sequence,
  };
}

export async function getDailySalesForBusinessDay(
  context: CurrentUserContext,
  businessDayId: string,
): Promise<DailySales | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("daily_sales_summaries")
    .select(
      "daily_sales_id, business_day_id, business_date, cash_sales_ron, bank_sales_ron, credit_sales_ron, total_sales_ron, status, notes, created_at, updated_at, last_draft_by, last_draft_by_name, last_draft_at, closed_at, active_closure_id, close_sequence",
    )
    .eq("business_id", context.business.id)
    .eq("business_day_id", businessDayId)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load daily sales.");
  }

  return data ? mapDailySales(data) : null;
}

export async function getDailySalesHistory(
  context: CurrentUserContext,
  period: Readonly<{ fromDate: string; toDate: string }>,
): Promise<readonly DailySales[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("daily_sales_summaries")
    .select(
      "daily_sales_id, business_day_id, business_date, cash_sales_ron, bank_sales_ron, credit_sales_ron, total_sales_ron, status, notes, created_at, updated_at, last_draft_by, last_draft_by_name, last_draft_at, closed_at, active_closure_id, close_sequence",
    )
    .eq("business_id", context.business.id)
    .gte("business_date", period.fromDate)
    .lte("business_date", period.toDate)
    .order("business_date", { ascending: false })
    .limit(366);

  if (error) {
    throw new Error("Unable to load daily sales history.");
  }

  return data.map(mapDailySales);
}

export async function getBusinessDayCreditSales(
  context: CurrentUserContext,
  businessDayId: string,
): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("business_day_credit_sales")
    .select("credit_sales_ron")
    .eq("business_id", context.business.id)
    .eq("business_day_id", businessDayId)
    .single();

  if (error || data.credit_sales_ron === null) {
    throw new Error("Unable to load business-day credit sales.");
  }

  return data.credit_sales_ron;
}

export async function upsertDailySalesDraft(
  context: CurrentUserContext,
  input: DailySalesDraftInput,
): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("upsert_daily_sales_draft", {
    target_business_id: context.business.id,
    target_business_day_id: input.businessDayId,
    target_cash_sales_ron: input.cashSalesRon,
    target_bank_sales_ron: input.bankSalesRon,
    target_credit_sales_ron: input.creditSalesRon,
    target_notes: input.notes ?? undefined,
  });

  if (error || !data) {
    if (error?.message.includes("Credit sales must equal")) {
      throw new Error(
        "Credit purchases changed. Refresh and review the credit total.",
      );
    }

    if (error?.message.includes("Closed daily sales")) {
      throw new Error("Closed daily sales cannot be edited.");
    }

    throw new Error("Daily sales draft could not be saved.");
  }

  return data;
}
