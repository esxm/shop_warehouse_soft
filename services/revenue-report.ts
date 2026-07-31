import "server-only";

import type { CurrentUserContext } from "@/lib/auth/types";
import { createServerSupabaseClient } from "@/lib/db/server";
import {
  buildRevenueReport,
  type RevenueDateRange,
  type RevenueReport,
  type RevenueSourceRow,
} from "@/lib/reports/revenue";

const pageSize = 1000;

export async function getRevenueReport(
  context: CurrentUserContext,
  range: RevenueDateRange,
): Promise<RevenueReport> {
  const supabase = await createServerSupabaseClient();
  const rows: RevenueSourceRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("daily_net_revenue_summaries")
      .select(
        "business_date, cash_sales_ron, bank_sales_ron, credit_sales_ron, total_sales_ron",
      )
      .eq("business_id", context.business.id)
      .eq("status", "closed")
      .gte("business_date", range.fromDate)
      .lte("business_date", range.toDate)
      .order("business_date")
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error("Unable to load the revenue report.");
    }

    for (const row of data) {
      if (
        row.business_date === null ||
        row.cash_sales_ron === null ||
        row.bank_sales_ron === null ||
        row.credit_sales_ron === null ||
        row.total_sales_ron === null
      ) {
        throw new Error("Revenue report data is incomplete.");
      }

      rows.push({
        businessDate: row.business_date,
        cashSalesRon: row.cash_sales_ron,
        bankSalesRon: row.bank_sales_ron,
        creditSalesRon: row.credit_sales_ron,
        totalSalesRon: row.total_sales_ron,
      });
    }

    if (data.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return buildRevenueReport(rows);
}
