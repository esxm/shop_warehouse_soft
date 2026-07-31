import "server-only";

import type { CurrentUserContext } from "@/lib/auth/types";
import type { Json } from "@/lib/db/database.types";
import { createServerSupabaseClient } from "@/lib/db/server";
import type {
  InventoryExceptionInput,
  SaleReturnInput,
} from "@/lib/validation/returns-and-losses";

export type ReturnableSaleLine = Readonly<{
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  soldQuantity: string;
  returnedQuantity: string;
  returnableQuantity: string;
  unitCostRon: string;
  unitSellingPriceRon: string;
}>;

export type ReturnableSale = Readonly<{
  id: string;
  saleNumber: number;
  saleDate: string;
  customerName: string | null;
  originalCreditRon: string;
  creditAvailableRon: string;
  lines: readonly ReturnableSaleLine[];
}>;

export type SaleReturnLine = Readonly<{
  id: string;
  productCode: string;
  productName: string;
  quantity: string;
  disposition: "sellable" | "damaged";
  unitCostRon: string;
  unitRefundRon: string;
  lineCostRon: string;
  lineRefundRon: string;
}>;

export type SaleReturn = Readonly<{
  id: string;
  returnDate: string;
  saleId: string;
  saleNumber: number;
  customerName: string | null;
  cashRefundRon: string;
  bankRefundRon: string;
  creditReductionRon: string;
  totalRefundRon: string;
  totalCostRon: string;
  reason: string;
  createdByName: string | null;
  createdAt: string;
  status: "active" | "reversed";
  reversalReason: string | null;
  lines: readonly SaleReturnLine[];
}>;

export type InventoryExceptionOption = Readonly<{
  productId: string;
  productCode: string;
  productName: string;
  locationId: string;
  locationName: string;
  locationType: "warehouse" | "shop";
  quantity: string;
  averageUnitCostRon: string;
}>;

export type InventoryException = Readonly<{
  id: string;
  exceptionDate: string;
  productCode: string;
  productName: string;
  sourceLocationName: string;
  sourceLocationType: "warehouse" | "shop";
  exceptionType: "damage" | "missing" | "stolen";
  quantity: string;
  unitCostRon: string;
  totalCostRon: string;
  reason: string;
  createdByName: string | null;
  createdAt: string;
  status: "active" | "reversed";
  reversalReason: string | null;
}>;

export type DamagedStockBalance = Readonly<{
  productId: string;
  productCode: string;
  productName: string;
  quantity: string;
  historicalCostRon: string;
}>;

export async function getReturnableSales(
  context: CurrentUserContext,
): Promise<readonly ReturnableSale[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("returnable_sale_line_summaries")
    .select(
      "sale_id, sale_number, sale_date, customer_name, original_credit_ron, credit_available_ron, sale_line_id, product_id, product_code, product_name, sold_quantity, returned_quantity, returnable_quantity, unit_cost_ron, unit_selling_price_ron",
    )
    .eq("business_id", context.business.id)
    .order("sale_date", { ascending: false })
    .order("sale_number", { ascending: false });

  if (error) {
    throw new Error("Unable to load sales available for return.");
  }

  const sales = new Map<string, ReturnableSale>();
  for (const row of data) {
    if (
      !row.sale_id ||
      row.sale_number === null ||
      !row.sale_date ||
      row.original_credit_ron === null ||
      row.credit_available_ron === null ||
      !row.sale_line_id ||
      !row.product_id ||
      !row.product_code ||
      !row.product_name ||
      !row.sold_quantity ||
      !row.returned_quantity ||
      !row.returnable_quantity ||
      !row.unit_cost_ron ||
      !row.unit_selling_price_ron
    ) {
      throw new Error("Returnable sale data is incomplete.");
    }

    const line: ReturnableSaleLine = {
      id: row.sale_line_id,
      productId: row.product_id,
      productCode: row.product_code,
      productName: row.product_name,
      soldQuantity: row.sold_quantity,
      returnedQuantity: row.returned_quantity,
      returnableQuantity: row.returnable_quantity,
      unitCostRon: row.unit_cost_ron,
      unitSellingPriceRon: row.unit_selling_price_ron,
    };
    const existing = sales.get(row.sale_id);
    if (existing) {
      (existing.lines as ReturnableSaleLine[]).push(line);
    } else {
      sales.set(row.sale_id, {
        id: row.sale_id,
        saleNumber: row.sale_number,
        saleDate: row.sale_date,
        customerName: row.customer_name,
        originalCreditRon: row.original_credit_ron,
        creditAvailableRon: row.credit_available_ron,
        lines: [line],
      });
    }
  }

  return [...sales.values()];
}

export async function getSaleReturns(
  context: CurrentUserContext,
  period: Readonly<{ fromDate: string; toDate: string }>,
): Promise<readonly SaleReturn[]> {
  const supabase = await createServerSupabaseClient();
  const [{ data, error }, { data: lineData, error: lineError }] =
    await Promise.all([
      supabase
        .from("sale_return_summaries")
        .select(
          "sale_return_id, return_date, sale_id, sale_number, customer_name, cash_refund_ron, bank_refund_ron, credit_reduction_ron, total_refund_ron, total_cost_ron, reason, created_by_name, created_at, status, reversal_reason",
        )
        .eq("business_id", context.business.id)
        .gte("return_date", period.fromDate)
        .lte("return_date", period.toDate)
        .order("return_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("sale_return_line_summaries")
        .select(
          "line_id, sale_return_id, product_code, product_name, quantity, disposition, unit_cost_ron, unit_refund_ron, line_cost_ron, line_refund_ron",
        )
        .eq("business_id", context.business.id)
        .order("line_number"),
    ]);

  if (error || lineError) {
    throw new Error("Unable to load sale return history.");
  }

  const linesByReturn = new Map<string, SaleReturnLine[]>();
  for (const row of lineData) {
    if (
      !row.line_id ||
      !row.sale_return_id ||
      !row.product_code ||
      !row.product_name ||
      !row.quantity ||
      (row.disposition !== "sellable" && row.disposition !== "damaged") ||
      !row.unit_cost_ron ||
      !row.unit_refund_ron ||
      !row.line_cost_ron ||
      !row.line_refund_ron
    ) {
      throw new Error("Sale return line data is incomplete.");
    }
    const lines = linesByReturn.get(row.sale_return_id) ?? [];
    lines.push({
      id: row.line_id,
      productCode: row.product_code,
      productName: row.product_name,
      quantity: row.quantity,
      disposition: row.disposition,
      unitCostRon: row.unit_cost_ron,
      unitRefundRon: row.unit_refund_ron,
      lineCostRon: row.line_cost_ron,
      lineRefundRon: row.line_refund_ron,
    });
    linesByReturn.set(row.sale_return_id, lines);
  }

  return data.map((row) => {
    if (
      !row.sale_return_id ||
      !row.return_date ||
      !row.sale_id ||
      row.sale_number === null ||
      !row.cash_refund_ron ||
      !row.bank_refund_ron ||
      !row.credit_reduction_ron ||
      !row.total_refund_ron ||
      !row.total_cost_ron ||
      !row.reason ||
      !row.created_at ||
      (row.status !== "active" && row.status !== "reversed")
    ) {
      throw new Error("Sale return data is incomplete.");
    }
    return {
      id: row.sale_return_id,
      returnDate: row.return_date,
      saleId: row.sale_id,
      saleNumber: row.sale_number,
      customerName: row.customer_name,
      cashRefundRon: row.cash_refund_ron,
      bankRefundRon: row.bank_refund_ron,
      creditReductionRon: row.credit_reduction_ron,
      totalRefundRon: row.total_refund_ron,
      totalCostRon: row.total_cost_ron,
      reason: row.reason,
      createdByName: row.created_by_name,
      createdAt: row.created_at,
      status: row.status,
      reversalReason: row.reversal_reason,
      lines: linesByReturn.get(row.sale_return_id) ?? [],
    };
  });
}

export async function getInventoryExceptionOptions(
  context: CurrentUserContext,
): Promise<readonly InventoryExceptionOption[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("product_stock_valuation_by_location")
    .select(
      "product_id, internal_code, product_name, location_id, location_name, location_type, quantity, average_unit_cost_ron, cost_is_complete",
    )
    .eq("business_id", context.business.id)
    .eq("product_is_active", true)
    .order("product_name");

  if (error) {
    throw new Error("Unable to load inventory exception products.");
  }

  return data.flatMap((row) => {
    if (
      !row.product_id ||
      !row.internal_code ||
      !row.product_name ||
      !row.location_id ||
      !row.location_name ||
      (row.location_type !== "warehouse" && row.location_type !== "shop") ||
      !row.quantity
    ) {
      throw new Error("Inventory exception option data is incomplete.");
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
        productId: row.product_id,
        productCode: row.internal_code,
        productName: row.product_name,
        locationId: row.location_id,
        locationName: row.location_name,
        locationType: row.location_type,
        quantity: row.quantity,
        averageUnitCostRon: row.average_unit_cost_ron,
      },
    ];
  });
}

export async function getInventoryExceptions(
  context: CurrentUserContext,
  period: Readonly<{ fromDate: string; toDate: string }>,
): Promise<readonly InventoryException[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("inventory_exception_summaries")
    .select(
      "inventory_exception_id, exception_date, product_code, product_name, source_location_name, source_location_type, exception_type, quantity, unit_cost_ron, total_cost_ron, reason, created_by_name, created_at, status, reversal_reason",
    )
    .eq("business_id", context.business.id)
    .gte("exception_date", period.fromDate)
    .lte("exception_date", period.toDate)
    .order("exception_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error("Unable to load inventory exception history.");
  }

  return data.map((row) => {
    if (
      !row.inventory_exception_id ||
      !row.exception_date ||
      !row.product_code ||
      !row.product_name ||
      !row.source_location_name ||
      (row.source_location_type !== "warehouse" &&
        row.source_location_type !== "shop") ||
      (row.exception_type !== "damage" &&
        row.exception_type !== "missing" &&
        row.exception_type !== "stolen") ||
      !row.quantity ||
      !row.unit_cost_ron ||
      !row.total_cost_ron ||
      !row.reason ||
      !row.created_at ||
      (row.status !== "active" && row.status !== "reversed")
    ) {
      throw new Error("Inventory exception data is incomplete.");
    }
    return {
      id: row.inventory_exception_id,
      exceptionDate: row.exception_date,
      productCode: row.product_code,
      productName: row.product_name,
      sourceLocationName: row.source_location_name,
      sourceLocationType: row.source_location_type,
      exceptionType: row.exception_type,
      quantity: row.quantity,
      unitCostRon: row.unit_cost_ron,
      totalCostRon: row.total_cost_ron,
      reason: row.reason,
      createdByName: row.created_by_name,
      createdAt: row.created_at,
      status: row.status,
      reversalReason: row.reversal_reason,
    };
  });
}

export async function getDamagedStockBalances(
  context: CurrentUserContext,
): Promise<readonly DamagedStockBalance[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("damaged_stock_balances")
    .select(
      "product_id, internal_code, product_name, damaged_quantity, historical_cost_ron",
    )
    .eq("business_id", context.business.id)
    .order("product_name");

  if (error) {
    throw new Error("Unable to load damaged stock.");
  }

  return data.flatMap((row) => {
    if (
      !row.product_id ||
      !row.internal_code ||
      !row.product_name ||
      row.damaged_quantity === null ||
      row.historical_cost_ron === null
    ) {
      throw new Error("Damaged stock data is incomplete.");
    }
    if (BigInt(row.damaged_quantity) <= BigInt(0)) {
      return [];
    }
    return [
      {
        productId: row.product_id,
        productCode: row.internal_code,
        productName: row.product_name,
        quantity: row.damaged_quantity,
        historicalCostRon: row.historical_cost_ron,
      },
    ];
  });
}

export async function createSaleReturn(
  context: CurrentUserContext,
  input: SaleReturnInput,
): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_sale_return", {
    target_bank_refund_ron: input.bankRefundRon,
    target_business_day_id: input.businessDayId,
    target_business_id: context.business.id,
    target_cash_refund_ron: input.cashRefundRon,
    target_credit_reduction_ron: input.creditReductionRon,
    target_idempotency_key: input.idempotencyKey,
    target_lines: input.lines.map((line) => ({
      sale_line_id: line.saleLineId,
      quantity: line.quantity,
      disposition: line.disposition,
    })) as Json,
    target_reason: input.reason,
    target_sale_id: input.saleId,
  });

  if (error || !data) {
    if (error?.message.includes("unreturned sale quantity")) {
      throw new Error("A return quantity exceeds the remaining sold quantity.");
    }
    if (error?.message.includes("Refund split")) {
      throw new Error("Cash, bank, and credit must equal the return total.");
    }
    if (error?.message.includes("unpaid sale credit")) {
      throw new Error("Credit reduction exceeds the unpaid sale credit.");
    }
    throw new Error("Sale return could not be recorded.");
  }
  return data;
}

export async function reverseSaleReturn(
  context: CurrentUserContext,
  saleReturnId: string,
  reason: string,
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("reverse_sale_return", {
    target_business_id: context.business.id,
    target_reason: reason,
    target_sale_return_id: saleReturnId,
  });
  if (error) {
    if (error.message.includes("already reversed")) {
      throw new Error("This sale return is already reversed.");
    }
    if (error.message.includes("negative")) {
      throw new Error(
        "Returned sellable stock has already been used and cannot be reversed.",
      );
    }
    throw new Error("Sale return could not be reversed.");
  }
}

export async function createInventoryException(
  context: CurrentUserContext,
  input: InventoryExceptionInput,
): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_inventory_exception", {
    target_business_day_id: input.businessDayId,
    target_business_id: context.business.id,
    target_exception_type: input.exceptionType,
    target_idempotency_key: input.idempotencyKey,
    target_product_id: input.productId,
    target_quantity: input.quantity,
    target_reason: input.reason,
    target_source_location_id: input.sourceLocationId,
  });
  if (error || !data) {
    if (error?.message.includes("exceeds available stock")) {
      throw new Error("Exception quantity exceeds available stock.");
    }
    if (error?.message.includes("historical buying cost")) {
      throw new Error("Product stock has no complete historical buying cost.");
    }
    throw new Error("Inventory exception could not be recorded.");
  }
  return data;
}

export async function reverseInventoryException(
  context: CurrentUserContext,
  inventoryExceptionId: string,
  reason: string,
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("reverse_inventory_exception", {
    target_business_id: context.business.id,
    target_inventory_exception_id: inventoryExceptionId,
    target_reason: reason,
  });
  if (error) {
    if (error.message.includes("already reversed")) {
      throw new Error("This inventory exception is already reversed.");
    }
    throw new Error("Inventory exception could not be reversed.");
  }
}
