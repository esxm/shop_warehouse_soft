import "server-only";

import type { CurrentUserContext } from "@/lib/auth/types";
import {
  buildProfitReport,
  type ProfitReport,
  type ProfitSourceRow,
} from "@/lib/reports/profit";
import type { RevenueDateRange } from "@/lib/reports/revenue";
import { createServerSupabaseClient } from "@/lib/db/server";

const pageSize = 1000;

export async function getProfitReport(
  context: CurrentUserContext,
  range: RevenueDateRange,
): Promise<ProfitReport> {
  const supabase = await createServerSupabaseClient();
  const rows: ProfitSourceRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("product_sales_daily_analysis")
      .select(
        "activity_date, sold_quantity, returned_quantity, net_revenue_ron, historical_cost_ron, gross_margin_ron",
      )
      .eq("business_id", context.business.id)
      .gte("activity_date", range.fromDate)
      .lte("activity_date", range.toDate)
      .order("activity_date")
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error("Unable to load the product profit report.");
    }

    for (const row of data) {
      if (
        !row.activity_date ||
        row.sold_quantity === null ||
        row.returned_quantity === null ||
        row.net_revenue_ron === null ||
        row.historical_cost_ron === null ||
        row.gross_margin_ron === null
      ) {
        throw new Error("Product profit report data is incomplete.");
      }
      rows.push({
        activityDate: row.activity_date,
        soldQuantity: row.sold_quantity,
        returnedQuantity: row.returned_quantity,
        netRevenueRon: row.net_revenue_ron,
        historicalCostRon: row.historical_cost_ron,
        grossMarginRon: row.gross_margin_ron,
      });
    }

    if (data.length < pageSize) {
      break;
    }
    offset += pageSize;
  }

  return buildProfitReport(rows);
}
