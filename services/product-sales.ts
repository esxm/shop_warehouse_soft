import "server-only";

import type { CurrentUserContext } from "@/lib/auth/types";
import type { Json } from "@/lib/db/database.types";
import { createServerSupabaseClient } from "@/lib/db/server";
import type { ProductSaleInput } from "@/lib/validation/product-sales";

export type ProductSaleOption = Readonly<{
  id: string;
  internalCode: string;
  name: string;
  shopLocationId: string;
  shopLocationName: string;
  shopQuantity: string;
  averageUnitCostRon: string;
}>;

export type ProductSaleLine = Readonly<{
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  lineNumber: number;
  quantity: string;
  unitCostRon: string;
  unitSellingPriceRon: string;
  lineCostRon: string;
  lineTotalRon: string;
  grossProfitRon: string;
  profitPercent: string;
}>;

export type ProductSale = Readonly<{
  id: string;
  businessDayId: string;
  saleDate: string;
  saleNumber: number;
  shopLocationId: string;
  shopLocationName: string;
  customerId: string | null;
  customerName: string | null;
  cashAmountRon: string;
  bankAmountRon: string;
  creditAmountRon: string;
  totalAmountRon: string;
  totalCostRon: string;
  grossProfitRon: string;
  profitPercent: string;
  notes: string | null;
  createdBy: string;
  createdByName: string | null;
  createdAt: string;
  status: "active" | "reversed";
  reversalReason: string | null;
  lines: readonly ProductSaleLine[];
}>;

export type DailyProductSalesSummary = Readonly<{
  businessDayId: string;
  businessDate: string;
  saleCount: number;
  cashAmountRon: string;
  bankAmountRon: string;
  creditAmountRon: string;
  totalAmountRon: string;
  totalCostRon: string;
  grossProfitRon: string;
  profitPercent: string;
}>;

export async function getProductSaleOptions(
  context: CurrentUserContext,
): Promise<readonly ProductSaleOption[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("product_stock_valuation_by_location")
    .select(
      "product_id, internal_code, product_name, location_id, location_name, quantity, average_unit_cost_ron, cost_is_complete",
    )
    .eq("business_id", context.business.id)
    .eq("location_type", "shop")
    .eq("product_is_active", true)
    .order("product_name");

  if (error) {
    throw new Error("Unable to load products available for sale.");
  }

  return data.flatMap((row) => {
    if (
      !row.product_id ||
      !row.internal_code ||
      !row.product_name ||
      !row.location_id ||
      !row.location_name ||
      row.quantity === null
    ) {
      throw new Error("Product sale option data is incomplete.");
    }

    if (
      BigInt(row.quantity) <= BigInt(0) ||
      !row.cost_is_complete ||
      !row.average_unit_cost_ron
    ) {
      return [];
    }

    return [
      {
        id: row.product_id,
        internalCode: row.internal_code,
        name: row.product_name,
        shopLocationId: row.location_id,
        shopLocationName: row.location_name,
        shopQuantity: row.quantity,
        averageUnitCostRon: row.average_unit_cost_ron,
      },
    ];
  });
}

export async function getProductSales(
  context: CurrentUserContext,
  period: Readonly<{ fromDate: string; toDate: string }>,
  limit = 100,
): Promise<readonly ProductSale[]> {
  const supabase = await createServerSupabaseClient();
  const [{ data, error }, { data: lineData, error: lineError }] =
    await Promise.all([
      supabase
        .from("sale_summaries")
        .select(
          "sale_id, business_day_id, sale_date, sale_number, shop_location_id, shop_location_name, customer_id, customer_name, cash_amount_ron, bank_amount_ron, credit_amount_ron, total_amount_ron, total_cost_ron, gross_profit_ron, profit_percent, notes, created_by, created_by_name, created_at, status, reversal_reason",
        )
        .eq("business_id", context.business.id)
        .gte("sale_date", period.fromDate)
        .lte("sale_date", period.toDate)
        .order("sale_date", { ascending: false })
        .order("sale_number", { ascending: false })
        .limit(limit),
      supabase
        .from("sale_line_summaries")
        .select(
          "line_id, sale_id, product_id, product_code, product_name, line_number, quantity, unit_cost_ron, unit_selling_price_ron, line_cost_ron, line_total_ron, gross_profit_ron, profit_percent",
        )
        .eq("business_id", context.business.id)
        .order("line_number"),
    ]);

  if (error || lineError) {
    throw new Error("Unable to load product sales.");
  }

  const linesBySale = new Map<string, ProductSaleLine[]>();
  for (const line of lineData) {
    if (
      !line.line_id ||
      !line.sale_id ||
      !line.product_id ||
      !line.product_code ||
      !line.product_name ||
      line.line_number === null ||
      !line.quantity ||
      !line.unit_cost_ron ||
      !line.unit_selling_price_ron ||
      !line.line_cost_ron ||
      !line.line_total_ron ||
      !line.gross_profit_ron ||
      !line.profit_percent
    ) {
      throw new Error("Product sale line data is incomplete.");
    }

    const mappedLine: ProductSaleLine = {
      id: line.line_id,
      productId: line.product_id,
      productCode: line.product_code,
      productName: line.product_name,
      lineNumber: line.line_number,
      quantity: line.quantity,
      unitCostRon: line.unit_cost_ron,
      unitSellingPriceRon: line.unit_selling_price_ron,
      lineCostRon: line.line_cost_ron,
      lineTotalRon: line.line_total_ron,
      grossProfitRon: line.gross_profit_ron,
      profitPercent: line.profit_percent,
    };
    const existing = linesBySale.get(line.sale_id) ?? [];
    existing.push(mappedLine);
    linesBySale.set(line.sale_id, existing);
  }

  return data.map((row) => {
    if (
      !row.sale_id ||
      !row.business_day_id ||
      !row.sale_date ||
      row.sale_number === null ||
      !row.shop_location_id ||
      !row.shop_location_name ||
      !row.cash_amount_ron ||
      !row.bank_amount_ron ||
      !row.credit_amount_ron ||
      !row.total_amount_ron ||
      !row.total_cost_ron ||
      !row.gross_profit_ron ||
      !row.profit_percent ||
      !row.created_by ||
      !row.created_at ||
      (row.status !== "active" && row.status !== "reversed")
    ) {
      throw new Error("Product sale data is incomplete.");
    }

    return {
      id: row.sale_id,
      businessDayId: row.business_day_id,
      saleDate: row.sale_date,
      saleNumber: row.sale_number,
      shopLocationId: row.shop_location_id,
      shopLocationName: row.shop_location_name,
      customerId: row.customer_id,
      customerName: row.customer_name,
      cashAmountRon: row.cash_amount_ron,
      bankAmountRon: row.bank_amount_ron,
      creditAmountRon: row.credit_amount_ron,
      totalAmountRon: row.total_amount_ron,
      totalCostRon: row.total_cost_ron,
      grossProfitRon: row.gross_profit_ron,
      profitPercent: row.profit_percent,
      notes: row.notes,
      createdBy: row.created_by,
      createdByName: row.created_by_name,
      createdAt: row.created_at,
      status: row.status,
      reversalReason: row.reversal_reason,
      lines: linesBySale.get(row.sale_id) ?? [],
    };
  });
}

export async function getDailyProductSalesSummaries(
  context: CurrentUserContext,
  businessDates: readonly string[],
): Promise<readonly DailyProductSalesSummary[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("daily_product_sales_summaries")
    .select(
      "business_day_id, business_date, sale_count, cash_amount_ron, bank_amount_ron, credit_amount_ron, total_amount_ron, total_cost_ron, gross_profit_ron, profit_percent",
    )
    .eq("business_id", context.business.id)
    .in("business_date", businessDates)
    .order("business_date", { ascending: false })
    .limit(Math.max(businessDates.length, 1));

  if (error) {
    throw new Error("Unable to load daily product sale summaries.");
  }

  return data.map((row) => {
    if (
      !row.business_day_id ||
      !row.business_date ||
      row.sale_count === null ||
      row.cash_amount_ron === null ||
      row.bank_amount_ron === null ||
      row.credit_amount_ron === null ||
      row.total_amount_ron === null ||
      row.total_cost_ron === null ||
      row.gross_profit_ron === null ||
      row.profit_percent === null
    ) {
      throw new Error("Daily product sale summary is incomplete.");
    }

    return {
      businessDayId: row.business_day_id,
      businessDate: row.business_date,
      saleCount: row.sale_count,
      cashAmountRon: row.cash_amount_ron,
      bankAmountRon: row.bank_amount_ron,
      creditAmountRon: row.credit_amount_ron,
      totalAmountRon: row.total_amount_ron,
      totalCostRon: row.total_cost_ron,
      grossProfitRon: row.gross_profit_ron,
      profitPercent: row.profit_percent,
    };
  });
}

export async function createProductSale(
  context: CurrentUserContext,
  input: ProductSaleInput,
): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_product_sale", {
    target_bank_amount_ron: input.bankAmountRon,
    target_business_day_id: input.businessDayId,
    target_business_id: context.business.id,
    target_cash_amount_ron: input.cashAmountRon,
    target_credit_amount_ron: input.creditAmountRon,
    target_customer_id: input.customerId ?? undefined,
    target_idempotency_key: input.idempotencyKey,
    target_lines: input.lines.map((line) => ({
      product_id: line.productId,
      quantity: line.quantity,
      unit_selling_price_ron: line.unitSellingPriceRon,
    })) as Json,
    target_notes: input.notes ?? undefined,
    target_shop_location_id: input.shopLocationId,
  });

  if (error || !data) {
    if (error?.message.includes("Insufficient shop quantity")) {
      throw new Error("A product exceeds its available shop quantity.");
    }
    if (error?.message.includes("Shop cost is unavailable")) {
      throw new Error(
        "A selected product is missing a complete historical buying cost.",
      );
    }
    if (
      error?.message.includes(
        "Inventory movement exceeds source inventory value",
      )
    ) {
      throw new Error(
        "Shop product value is not synchronized with its stock. Refresh and try again.",
      );
    }
    if (error?.message.includes("Payment split")) {
      throw new Error("Cash, bank, and credit must equal the sale total.");
    }
    if (error?.message.includes("active RON cash account")) {
      throw new Error("Cash sales require an active RON cash account.");
    }
    if (error?.message.includes("active RON bank account")) {
      throw new Error("Bank sales require an active RON bank account.");
    }
    if (error?.message.includes("reused with different data")) {
      throw new Error("Sale request identifier was already used.");
    }
    throw new Error("Product sale could not be recorded.");
  }

  return data;
}

export async function reverseProductSale(
  context: CurrentUserContext,
  saleId: string,
  reason: string,
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("reverse_product_sale", {
    target_business_id: context.business.id,
    target_reason: reason,
    target_sale_id: saleId,
  });

  if (error) {
    if (error.message.includes("already reversed")) {
      throw new Error("This sale is already reversed.");
    }
    if (error.message.includes("allocated")) {
      throw new Error(
        "Reverse the customer's allocated payments before correcting this credit sale.",
      );
    }
    if (error.message.includes("Closed-day")) {
      throw new Error(
        "Closed-day sales must use the returns and refunds workflow.",
      );
    }
    throw new Error("Product sale could not be reversed.");
  }
}
