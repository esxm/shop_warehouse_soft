import "server-only";

import Decimal from "decimal.js";

import type { CurrentUserContext } from "@/lib/auth/types";
import { createServerSupabaseClient } from "@/lib/db/server";
import {
  buildInventoryAnalysisReport,
  type CurrentInventorySourceRow,
  type InventoryAnalysisReport,
  type ProductMovementAnalysisRow,
  type ProductSalesDailySourceRow,
} from "@/lib/reports/inventory-analysis";
import type { RevenueDateRange } from "@/lib/reports/revenue";
import type { StockThresholdInput } from "@/lib/validation/inventory-analysis";

const pageSize = 1000;

export async function getInventoryAnalysis(
  context: CurrentUserContext,
  range: RevenueDateRange,
): Promise<InventoryAnalysisReport> {
  const supabase = await createServerSupabaseClient();
  const currentInventory: CurrentInventorySourceRow[] = [];
  let currentOffset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("product_inventory_analysis_current")
      .select(
        "product_id, internal_code, product_name, category_name, product_is_active, location_id, location_name, location_type, quantity, minimum_quantity, is_low_stock, average_unit_cost_ron, inventory_value_ron, cost_is_complete",
      )
      .eq("business_id", context.business.id)
      .order("product_name")
      .order("location_type")
      .range(currentOffset, currentOffset + pageSize - 1);

    if (error) {
      throw new Error("Unable to load current inventory analysis.");
    }

    for (const row of data) {
      if (
        !row.product_id ||
        !row.internal_code ||
        !row.product_name ||
        !row.category_name ||
        row.product_is_active === null ||
        !row.location_id ||
        !row.location_name ||
        (row.location_type !== "warehouse" && row.location_type !== "shop") ||
        row.quantity === null ||
        row.minimum_quantity === null ||
        row.is_low_stock === null ||
        row.inventory_value_ron === null ||
        row.cost_is_complete === null
      ) {
        throw new Error("Current inventory analysis data is incomplete.");
      }

      currentInventory.push({
        productId: row.product_id,
        productCode: row.internal_code,
        productName: row.product_name,
        categoryName: row.category_name,
        productIsActive: row.product_is_active,
        locationId: row.location_id,
        locationName: row.location_name,
        locationType: row.location_type,
        quantity: row.quantity,
        minimumQuantity: row.minimum_quantity,
        isLowStock: row.is_low_stock,
        averageUnitCostRon: row.average_unit_cost_ron,
        inventoryValueRon: new Decimal(row.inventory_value_ron).toFixed(2),
        costIsComplete: row.cost_is_complete,
      });
    }

    if (data.length < pageSize) {
      break;
    }
    currentOffset += pageSize;
  }

  const salesDaily: ProductSalesDailySourceRow[] = [];
  let salesOffset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("product_sales_daily_analysis")
      .select(
        "activity_date, product_id, internal_code, product_name, category_name, sale_count, return_count, sold_quantity, returned_quantity, net_quantity, gross_sales_ron, refunds_ron, net_revenue_ron, historical_cost_ron, gross_margin_ron",
      )
      .eq("business_id", context.business.id)
      .gte("activity_date", range.fromDate)
      .lte("activity_date", range.toDate)
      .order("activity_date")
      .order("product_name")
      .range(salesOffset, salesOffset + pageSize - 1);

    if (error) {
      throw new Error("Unable to load product sales analysis.");
    }

    for (const row of data) {
      if (
        !row.activity_date ||
        !row.product_id ||
        !row.internal_code ||
        !row.product_name ||
        !row.category_name ||
        row.sale_count === null ||
        row.return_count === null ||
        row.sold_quantity === null ||
        row.returned_quantity === null ||
        row.net_quantity === null ||
        row.gross_sales_ron === null ||
        row.refunds_ron === null ||
        row.net_revenue_ron === null ||
        row.historical_cost_ron === null ||
        row.gross_margin_ron === null
      ) {
        throw new Error("Product sales analysis data is incomplete.");
      }
      salesDaily.push({
        activityDate: row.activity_date,
        productId: row.product_id,
        productCode: row.internal_code,
        productName: row.product_name,
        categoryName: row.category_name,
        saleCount: row.sale_count,
        returnCount: row.return_count,
        soldQuantity: row.sold_quantity,
        returnedQuantity: row.returned_quantity,
        netQuantity: row.net_quantity,
        grossSalesRon: row.gross_sales_ron,
        refundsRon: row.refunds_ron,
        netRevenueRon: row.net_revenue_ron,
        historicalCostRon: row.historical_cost_ron,
        grossMarginRon: row.gross_margin_ron,
      });
    }

    if (data.length < pageSize) {
      break;
    }
    salesOffset += pageSize;
  }

  const movements: ProductMovementAnalysisRow[] = [];
  let movementOffset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("stock_movement_summaries")
      .select(
        "movement_id, business_date, product_code, product_name, movement_type, source_location_name, destination_location_name, quantity, unit_cost_ron, status, reference_type, created_by_name, created_at",
      )
      .eq("business_id", context.business.id)
      .gte("business_date", range.fromDate)
      .lte("business_date", range.toDate)
      .order("business_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(movementOffset, movementOffset + pageSize - 1);

    if (error) {
      throw new Error("Unable to load product movement analysis.");
    }

    for (const row of data) {
      if (
        !row.movement_id ||
        !row.business_date ||
        !row.product_code ||
        !row.product_name ||
        !row.movement_type ||
        !row.quantity ||
        !row.reference_type ||
        !row.created_at ||
        (row.status !== "active" &&
          row.status !== "reversed" &&
          row.status !== "reversal")
      ) {
        throw new Error("Product movement analysis data is incomplete.");
      }
      movements.push({
        id: row.movement_id,
        businessDate: row.business_date,
        productCode: row.product_code,
        productName: row.product_name,
        movementType: row.movement_type,
        sourceLocationName: row.source_location_name,
        destinationLocationName: row.destination_location_name,
        quantity: row.quantity,
        unitCostRon: row.unit_cost_ron,
        status: row.status,
        referenceType: row.reference_type,
        createdByName: row.created_by_name,
        createdAt: row.created_at,
      });
    }

    if (data.length < pageSize) {
      break;
    }
    movementOffset += pageSize;
  }

  return buildInventoryAnalysisReport(currentInventory, salesDaily, movements);
}

export async function setProductStockThreshold(
  context: CurrentUserContext,
  input: StockThresholdInput,
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("set_product_stock_threshold", {
    target_business_id: context.business.id,
    target_inventory_location_id: input.inventoryLocationId,
    target_minimum_quantity: input.minimumQuantity,
    target_product_id: input.productId,
  });

  if (error) {
    throw new Error("Low-stock threshold could not be saved.");
  }
}
