import "server-only";

import type { CurrentUserContext } from "@/lib/auth/types";
import type { Json } from "@/lib/db/database.types";
import { createServerSupabaseClient } from "@/lib/db/server";
import type { SupplierPurchaseInput } from "@/lib/validation/supplier-purchases";

export type InventoryLocationOption = Readonly<{
  id: string;
  name: string;
  type: "warehouse" | "shop";
}>;

export type SupplierPurchase = Readonly<{
  id: string;
  businessDayId: string | null;
  supplierId: string;
  purchaseDate: string;
  currency: "RON" | "USD";
  originalAmount: string;
  purchaseExchangeRate: string | null;
  inventoryCostRon: string;
  inventoryCostUsd: string | null;
  destinationLocationId: string | null;
  destinationLocationName: string | null;
  destinationLocationType: "warehouse" | "shop" | null;
  description: string | null;
  dueDate: string | null;
  entryOrigin: string;
  allocatedOriginalAmount: string;
  remainingOriginalAmount: string;
  remainingHistoricalRon: string;
  status: "unpaid" | "partial" | "paid" | "reversed";
  createdAt: string;
  reversedAt: string | null;
  reversalReason: string | null;
  recordMode: "value_only" | "product_lines";
  lines: readonly SupplierPurchaseLine[];
}>;

export type SupplierPurchaseLine = Readonly<{
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  lineNumber: number;
  quantity: string;
  unitPriceOriginalCurrency: string;
  purchaseExchangeRate: string;
  unitCostRon: string;
  unitCostUsd: string | null;
  lineTotalRon: string;
  lineTotalUsd: string | null;
}>;

export type SupplierPayableBalance = Readonly<{
  currency: "RON" | "USD";
  outstandingOriginalAmount: string;
  historicalRonAmount: string;
}>;

type SupplierPurchaseRow = Readonly<{
  purchase_id: string | null;
  business_day_id: string | null;
  supplier_id: string | null;
  purchase_date: string | null;
  currency: "RON" | "USD" | null;
  original_amount: string | null;
  purchase_exchange_rate: string | null;
  inventory_cost_ron: string | null;
  inventory_cost_usd: string | null;
  destination_location_id: string | null;
  destination_location_name: string | null;
  destination_location_type: "warehouse" | "shop" | null;
  description: string | null;
  due_date: string | null;
  entry_origin: string | null;
  derived_status: string | null;
  created_at: string | null;
  reversed_at: string | null;
  reversal_reason: string | null;
  allocated_original_amount: string | null;
  remaining_original_amount: string | null;
  remaining_historical_ron: string | null;
  record_mode: string | null;
  product_line_count: number | null;
}>;

function mapPurchase(
  row: SupplierPurchaseRow,
  lines: readonly SupplierPurchaseLine[],
): SupplierPurchase {
  if (
    !row.purchase_id ||
    !row.supplier_id ||
    !row.purchase_date ||
    !row.currency ||
    !row.original_amount ||
    !row.inventory_cost_ron ||
    !row.entry_origin ||
    !row.allocated_original_amount ||
    !row.remaining_original_amount ||
    !row.remaining_historical_ron ||
    !row.created_at ||
    row.product_line_count === null ||
    row.product_line_count !== lines.length ||
    (row.record_mode !== "value_only" && row.record_mode !== "product_lines") ||
    (row.derived_status !== "unpaid" &&
      row.derived_status !== "partial" &&
      row.derived_status !== "paid" &&
      row.derived_status !== "reversed")
  ) {
    throw new Error("Supplier purchase data is incomplete.");
  }

  return {
    id: row.purchase_id,
    businessDayId: row.business_day_id,
    supplierId: row.supplier_id,
    purchaseDate: row.purchase_date,
    currency: row.currency,
    originalAmount: row.original_amount,
    purchaseExchangeRate: row.purchase_exchange_rate,
    inventoryCostRon: row.inventory_cost_ron,
    inventoryCostUsd: row.inventory_cost_usd,
    destinationLocationId: row.destination_location_id,
    destinationLocationName: row.destination_location_name,
    destinationLocationType: row.destination_location_type,
    description: row.description,
    dueDate: row.due_date,
    entryOrigin: row.entry_origin,
    allocatedOriginalAmount: row.allocated_original_amount,
    remainingOriginalAmount: row.remaining_original_amount,
    remainingHistoricalRon: row.remaining_historical_ron,
    status: row.derived_status,
    createdAt: row.created_at,
    reversedAt: row.reversed_at,
    reversalReason: row.reversal_reason,
    recordMode: row.record_mode,
    lines,
  };
}

export async function getSupplierPurchases(
  context: CurrentUserContext,
  supplierId: string,
  period?: Readonly<{ fromDate?: string | null; toDate?: string | null }>,
): Promise<readonly SupplierPurchase[]> {
  const supabase = await createServerSupabaseClient();
  let purchaseQuery = supabase
    .from("supplier_purchase_summaries")
    .select(
      "purchase_id, business_day_id, supplier_id, purchase_date, currency, original_amount, purchase_exchange_rate, inventory_cost_ron, inventory_cost_usd, destination_location_id, destination_location_name, destination_location_type, description, due_date, entry_origin, derived_status, created_at, reversed_at, reversal_reason, allocated_original_amount, remaining_original_amount, remaining_historical_ron, record_mode, product_line_count",
    )
    .eq("business_id", context.business.id)
    .eq("supplier_id", supplierId)
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (period?.fromDate) {
    purchaseQuery = purchaseQuery.gte("purchase_date", period.fromDate);
  }

  if (period?.toDate) {
    purchaseQuery = purchaseQuery.lte("purchase_date", period.toDate);
  }

  const [{ data, error }, { data: lineData, error: lineError }] =
    await Promise.all([
      purchaseQuery,
      supabase
        .from("supplier_purchase_line_summaries")
        .select(
          "line_id, supplier_purchase_id, product_id, product_code, product_name, line_number, quantity, unit_price_original_currency, purchase_exchange_rate, unit_cost_ron, unit_cost_usd, line_total_ron, line_total_usd",
        )
        .eq("business_id", context.business.id)
        .order("line_number"),
    ]);

  if (error || lineError) {
    throw new Error("Unable to load supplier purchases.");
  }

  const linesByPurchase = new Map<string, SupplierPurchaseLine[]>();
  for (const line of lineData) {
    if (
      !line.line_id ||
      !line.supplier_purchase_id ||
      !line.product_id ||
      !line.product_code ||
      !line.product_name ||
      line.line_number === null ||
      !line.quantity ||
      !line.unit_price_original_currency ||
      !line.purchase_exchange_rate ||
      !line.unit_cost_ron ||
      !line.line_total_ron
    ) {
      throw new Error("Supplier purchase line data is incomplete.");
    }

    const mappedLine: SupplierPurchaseLine = {
      id: line.line_id,
      productId: line.product_id,
      productCode: line.product_code,
      productName: line.product_name,
      lineNumber: line.line_number,
      quantity: line.quantity,
      unitPriceOriginalCurrency: line.unit_price_original_currency,
      purchaseExchangeRate: line.purchase_exchange_rate,
      unitCostRon: line.unit_cost_ron,
      unitCostUsd: line.unit_cost_usd,
      lineTotalRon: line.line_total_ron,
      lineTotalUsd: line.line_total_usd,
    };
    const existing = linesByPurchase.get(line.supplier_purchase_id) ?? [];
    existing.push(mappedLine);
    linesByPurchase.set(line.supplier_purchase_id, existing);
  }

  return data.map((row) =>
    mapPurchase(
      row,
      row.purchase_id ? (linesByPurchase.get(row.purchase_id) ?? []) : [],
    ),
  );
}

export async function getSupplierPayableBalances(
  context: CurrentUserContext,
  supplierId: string,
): Promise<readonly SupplierPayableBalance[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("supplier_payable_balances")
    .select("currency, outstanding_original_amount, historical_ron_amount")
    .eq("business_id", context.business.id)
    .eq("supplier_id", supplierId)
    .order("currency");

  if (error) {
    throw new Error("Unable to load supplier payable balances.");
  }

  return data.map((row) => {
    if (
      !row.currency ||
      row.outstanding_original_amount === null ||
      row.historical_ron_amount === null
    ) {
      throw new Error("Supplier payable data is incomplete.");
    }

    return {
      currency: row.currency,
      outstandingOriginalAmount: row.outstanding_original_amount,
      historicalRonAmount: row.historical_ron_amount,
    };
  });
}

export async function getInventoryLocationOptions(
  context: CurrentUserContext,
): Promise<readonly InventoryLocationOption[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("inventory_locations")
    .select("id, name, type")
    .eq("business_id", context.business.id)
    .eq("is_active", true)
    .order("type");

  if (error) {
    throw new Error("Unable to load inventory locations.");
  }

  return data;
}

export async function createSupplierPurchase(
  context: CurrentUserContext,
  input: SupplierPurchaseInput,
): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "create_supplier_purchase_with_lines_idempotent",
    {
      target_business_id: context.business.id,
      target_supplier_id: input.supplierId,
      target_business_day_id: input.businessDayId,
      target_idempotency_key: input.idempotencyKey,
      target_currency: input.currency,
      target_purchase_exchange_rate: input.purchaseExchangeRate ?? "",
      target_destination_location_id: input.destinationLocationId,
      target_lines: input.lines.map((line) => ({
        product_id: line.productId,
        quantity: line.quantity,
        unit_price_original_currency: line.unitPriceOriginalCurrency,
      })) as Json,
      target_description: input.description ?? undefined,
      target_due_date: input.dueDate ?? undefined,
      target_audit_reason: input.auditReason ?? undefined,
    },
  );

  if (error || !data) {
    if (error?.message.includes("Historical entries require")) {
      throw new Error("Historical supplier purchases require an audit reason.");
    }

    if (error?.message.includes("current open business day")) {
      throw new Error("Use the current open business day.");
    }

    if (error?.message.includes("Inactive suppliers")) {
      throw new Error("Inactive suppliers cannot receive new purchases.");
    }

    if (error?.message.includes("Due date")) {
      throw new Error("Due date cannot be before the purchase date.");
    }

    if (error?.message.includes("reused with different data")) {
      throw new Error("Purchase request identifier was already used.");
    }

    if (error?.message.includes("Each product may appear only once")) {
      throw new Error("Each product may appear only once per purchase.");
    }

    if (error?.message.includes("Inactive products")) {
      throw new Error("Inactive products cannot be received.");
    }

    throw new Error("Supplier purchase could not be created.");
  }

  return data;
}

export async function reverseSupplierPurchase(
  context: CurrentUserContext,
  purchaseId: string,
  reason: string,
  allowNegativeStock: boolean,
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("reverse_supplier_purchase", {
    target_business_id: context.business.id,
    target_purchase_id: purchaseId,
    target_reason: reason,
    target_allow_negative_stock: allowNegativeStock,
  });

  if (error) {
    if (error.message.includes("make product quantity negative")) {
      throw new Error(
        "The reversal would make product stock negative. Enable the documented administrator override only if the physical count requires it.",
      );
    }

    if (error.code === "55000") {
      throw new Error(
        "This purchase is already reversed or must use opening-balance reversal.",
      );
    }

    throw new Error("Supplier purchase could not be reversed.");
  }
}
