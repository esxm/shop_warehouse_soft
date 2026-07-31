import "server-only";

import Decimal from "decimal.js";

import type { CurrentUserContext } from "@/lib/auth/types";
import { getTodayInBusinessTimeZone } from "@/lib/date/business-date";
import {
  calculateDashboardMetrics,
  type DashboardMetrics,
} from "@/lib/dashboard/formulas";
import { createServerSupabaseClient } from "@/lib/db/server";
import type { UsdRonReferenceRateInput } from "@/lib/validation/dashboard";

export type CurrentReferenceRate = Readonly<{
  rate: string;
  effectiveDate: string;
  createdAt: string;
}>;

export type DashboardData = Readonly<{
  asOfDate: string;
  metrics: DashboardMetrics;
  currentUsdRonRate: CurrentReferenceRate | null;
}>;

export async function getDashboardData(
  context: CurrentUserContext,
): Promise<DashboardData> {
  const supabase = await createServerSupabaseClient();
  const asOfDate = getTodayInBusinessTimeZone(context.business.timezone);
  const monthStart = `${asOfDate.slice(0, 7)}-01`;
  const [
    revenueResult,
    accountResult,
    receivableResult,
    payableResult,
    inventoryResult,
    rateResult,
  ] = await Promise.all([
    supabase
      .from("daily_net_revenue_summaries")
      .select("business_date, total_sales_ron")
      .eq("business_id", context.business.id)
      .eq("status", "closed")
      .gte("business_date", monthStart)
      .lte("business_date", asOfDate),
    supabase
      .from("financial_account_balances")
      .select("type, balance_ron")
      .eq("business_id", context.business.id),
    supabase
      .from("customer_receivable_balances")
      .select("outstanding_ron")
      .eq("business_id", context.business.id),
    supabase
      .from("supplier_payable_balances")
      .select("currency, outstanding_original_amount")
      .eq("business_id", context.business.id),
    supabase
      .from("product_stock_valuation_by_location")
      .select("inventory_value_ron, cost_is_complete")
      .eq("business_id", context.business.id),
    supabase
      .from("currency_reference_rate_summaries")
      .select("rate, effective_date, created_at")
      .eq("business_id", context.business.id)
      .eq("base_currency", "USD")
      .eq("quote_currency", "RON")
      .lte("effective_date", asOfDate)
      .order("effective_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (
    revenueResult.error ||
    accountResult.error ||
    receivableResult.error ||
    payableResult.error ||
    inventoryResult.error ||
    rateResult.error
  ) {
    throw new Error("Unable to load the dashboard.");
  }

  const revenues = revenueResult.data.map((row) => {
    if (!row.business_date || row.total_sales_ron === null) {
      throw new Error("Dashboard revenue data is incomplete.");
    }

    return {
      businessDate: row.business_date,
      totalSalesRon: row.total_sales_ron,
    };
  });
  const financialAccounts = accountResult.data.map((row) => {
    if (!row.type || row.balance_ron === null) {
      throw new Error("Dashboard account data is incomplete.");
    }

    return { type: row.type, balanceRon: row.balance_ron };
  });
  const receivables = receivableResult.data.map((row) => {
    if (row.outstanding_ron === null) {
      throw new Error("Dashboard receivable data is incomplete.");
    }

    return { outstandingRon: row.outstanding_ron };
  });
  const payables = payableResult.data.map((row) => {
    if (!row.currency || row.outstanding_original_amount === null) {
      throw new Error("Dashboard payable data is incomplete.");
    }

    return {
      currency: row.currency,
      outstandingOriginalAmount: row.outstanding_original_amount,
    };
  });
  const productInventory = inventoryResult.data.map((row) => {
    if (row.inventory_value_ron === null || row.cost_is_complete === null) {
      throw new Error("Dashboard product inventory data is incomplete.");
    }

    return {
      inventoryValueRon: new Decimal(row.inventory_value_ron).toFixed(2),
      costIsComplete: row.cost_is_complete,
    };
  });
  let currentUsdRonRate: CurrentReferenceRate | null = null;

  if (rateResult.data) {
    if (
      rateResult.data.rate === null ||
      rateResult.data.effective_date === null ||
      rateResult.data.created_at === null
    ) {
      throw new Error("Dashboard reference rate data is incomplete.");
    }

    currentUsdRonRate = {
      rate: rateResult.data.rate,
      effectiveDate: rateResult.data.effective_date,
      createdAt: rateResult.data.created_at,
    };
  }

  return {
    asOfDate,
    metrics: calculateDashboardMetrics({
      today: asOfDate,
      revenues,
      financialAccounts,
      receivables,
      payables,
      productInventory,
      usdRonRate: currentUsdRonRate?.rate ?? null,
    }),
    currentUsdRonRate,
  };
}

export async function recordUsdRonReferenceRate(
  context: CurrentUserContext,
  input: UsdRonReferenceRateInput,
): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("record_usd_ron_reference_rate", {
    target_business_id: context.business.id,
    target_rate: input.rate,
    target_effective_date: input.effectiveDate,
  });

  if (error || !data) {
    throw new Error("USD/RON reference rate could not be recorded.");
  }

  return data;
}
