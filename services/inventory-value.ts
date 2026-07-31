import "server-only";

import Decimal from "decimal.js";

import type { CurrentUserContext } from "@/lib/auth/types";
import type { Json } from "@/lib/db/database.types";
import { createServerSupabaseClient } from "@/lib/db/server";
import type { InventoryStocktakeInput } from "@/lib/validation/inventory-stocktakes";
import type { InventoryTransferInput } from "@/lib/validation/inventory-transfers";

export type InventoryLocationBalance = Readonly<{
  id: string;
  name: string;
  type: "warehouse" | "shop";
  balanceRon: string;
}>;

export type ProductInventoryValuationRow = Readonly<{
  productId: string;
  internalCode: string;
  productName: string;
  locationId: string;
  locationName: string;
  locationType: "warehouse" | "shop";
  quantity: string;
  averageUnitCostRon: string | null;
  averageUnitCostUsd: string | null;
  inventoryValueRon: string;
  inventoryValueUsd: string | null;
  usdCostSource: "stored_historical" | null;
  costIsComplete: boolean;
}>;

export type ProductInventoryValuation = Readonly<{
  rows: readonly ProductInventoryValuationRow[];
  totalRon: string;
  totalUsd: string | null;
  uncostedProductCount: number;
}>;

export type InventoryValueMovement = Readonly<{
  id: string;
  movementDate: string;
  movementType: string;
  sourceLocationId: string | null;
  destinationLocationId: string | null;
  amountRon: string;
  sourceEntityType: string;
  sourceEntityId: string;
  createdAt: string;
  reversalOfId: string | null;
}>;

export type InventoryTransfer = Readonly<{
  id: string;
  businessDayId: string;
  transferDate: string;
  sourceLocationId: string;
  sourceLocationName: string;
  destinationLocationId: string;
  destinationLocationName: string;
  amountRon: string;
  notes: string | null;
  entryOrigin: string;
  createdAt: string;
  status: "active" | "reversed";
  recordMode: "value_only" | "product_lines";
  lines: readonly InventoryTransferLine[];
}>;

export type InventoryTransferLine = Readonly<{
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  lineNumber: number;
  quantity: string;
  unitCostRon: string;
  lineTotalRon: string;
}>;

export type InventoryTransferProductOption = Readonly<{
  id: string;
  internalCode: string;
  name: string;
  warehouseLocationId: string;
  warehouseQuantity: string;
}>;

export type InventoryStocktake = Readonly<{
  id: string;
  stocktakeDate: string;
  warehouseExpectedValueRon: string;
  warehouseActualValueRon: string;
  warehouseDifferenceRon: string;
  shopExpectedValueRon: string;
  shopActualValueRon: string;
  shopDifferenceRon: string;
  reason: string;
  notes: string | null;
  createdAt: string;
  status: "active" | "reversed";
  reversedAt: string | null;
  reversalReason: string | null;
}>;

export async function getInventoryLocationBalances(
  context: CurrentUserContext,
): Promise<readonly InventoryLocationBalance[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("inventory_location_balances")
    .select("inventory_location_id, name, type, balance_ron")
    .eq("business_id", context.business.id)
    .order("type");

  if (error) {
    throw new Error("Unable to load inventory balances.");
  }

  return data.map((row) => {
    if (
      !row.inventory_location_id ||
      !row.name ||
      !row.type ||
      row.balance_ron === null
    ) {
      throw new Error("Inventory balance data is incomplete.");
    }

    return {
      id: row.inventory_location_id,
      name: row.name,
      type: row.type,
      balanceRon: row.balance_ron,
    };
  });
}

export async function getProductInventoryValuation(
  context: CurrentUserContext,
): Promise<ProductInventoryValuation> {
  const supabase = await createServerSupabaseClient();
  const valuationResult = await supabase
    .from("product_stock_valuation_by_location")
    .select(
      "product_id, internal_code, product_name, location_id, location_name, location_type, quantity, inventory_value_ron, inventory_value_usd, average_unit_cost_ron, average_unit_cost_usd, cost_is_complete",
    )
    .eq("business_id", context.business.id)
    .order("location_type")
    .order("product_name");

  if (valuationResult.error) {
    throw new Error("Unable to load product inventory valuation.");
  }

  const rows = valuationResult.data.flatMap((row) => {
    if (
      !row.product_id ||
      !row.internal_code ||
      !row.product_name ||
      !row.location_id ||
      !row.location_name ||
      (row.location_type !== "warehouse" && row.location_type !== "shop") ||
      row.quantity === null ||
      row.inventory_value_ron === null ||
      row.inventory_value_usd === null
    ) {
      throw new Error("Product inventory valuation data is incomplete.");
    }

    if (BigInt(row.quantity) === BigInt(0)) {
      return [];
    }

    const averageUnitCostRon = row.average_unit_cost_ron
      ? new Decimal(row.average_unit_cost_ron).toFixed(2)
      : null;
    const averageUnitCostUsd = row.average_unit_cost_usd
      ? new Decimal(row.average_unit_cost_usd).toFixed(2)
      : null;
    const inventoryValueRon = new Decimal(row.inventory_value_ron).toFixed(2);
    const inventoryValueUsd = new Decimal(row.inventory_value_usd).toFixed(2);

    return [
      {
        productId: row.product_id,
        internalCode: row.internal_code,
        productName: row.product_name,
        locationId: row.location_id,
        locationName: row.location_name,
        locationType: row.location_type,
        quantity: row.quantity,
        averageUnitCostRon,
        averageUnitCostUsd,
        inventoryValueRon,
        inventoryValueUsd: row.cost_is_complete ? inventoryValueUsd : null,
        usdCostSource: row.cost_is_complete
          ? ("stored_historical" as const)
          : null,
        costIsComplete: row.cost_is_complete ?? false,
      },
    ];
  });
  const totalRon = rows
    .reduce((total, row) => total.plus(row.inventoryValueRon), new Decimal(0))
    .toFixed(2);
  const completeRows = rows.filter((row) => row.costIsComplete);
  const totalUsd =
    completeRows.every((row) => row.inventoryValueUsd !== null) &&
    completeRows.length > 0
      ? completeRows
          .reduce(
            (total, row) => total.plus(row.inventoryValueUsd ?? "0"),
            new Decimal(0),
          )
          .toFixed(2)
      : null;

  return {
    rows,
    totalRon,
    totalUsd,
    uncostedProductCount: rows.filter((row) => !row.costIsComplete).length,
  };
}

export async function getInventoryValueMovements(
  context: CurrentUserContext,
  limit = 100,
): Promise<readonly InventoryValueMovement[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("inventory_value_movement_summaries")
    .select(
      "movement_id, movement_date, movement_type, source_location_id, destination_location_id, amount_ron, source_entity_type, source_entity_id, created_at, reversal_of_id",
    )
    .eq("business_id", context.business.id)
    .order("movement_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error("Unable to load inventory movement history.");
  }

  return data.map((row) => {
    if (
      !row.movement_id ||
      !row.movement_date ||
      !row.movement_type ||
      !row.amount_ron ||
      !row.source_entity_type ||
      !row.source_entity_id ||
      !row.created_at
    ) {
      throw new Error("Inventory movement data is incomplete.");
    }

    return {
      id: row.movement_id,
      movementDate: row.movement_date,
      movementType: row.movement_type,
      sourceLocationId: row.source_location_id,
      destinationLocationId: row.destination_location_id,
      amountRon: row.amount_ron,
      sourceEntityType: row.source_entity_type,
      sourceEntityId: row.source_entity_id,
      createdAt: row.created_at,
      reversalOfId: row.reversal_of_id,
    };
  });
}

export async function getInventoryTransfers(
  context: CurrentUserContext,
  period: Readonly<{ fromDate: string; toDate: string }>,
  limit = 100,
): Promise<readonly InventoryTransfer[]> {
  const supabase = await createServerSupabaseClient();
  const [{ data, error }, { data: lineData, error: lineError }] =
    await Promise.all([
      supabase
        .from("inventory_transfer_summaries")
        .select(
          "transfer_id, business_day_id, transfer_date, source_location_id, source_location_name, destination_location_id, destination_location_name, amount_ron, notes, entry_origin, created_at, status, product_line_count",
        )
        .eq("business_id", context.business.id)
        .gte("transfer_date", period.fromDate)
        .lte("transfer_date", period.toDate)
        .order("transfer_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("inventory_transfer_line_summaries")
        .select(
          "line_id, inventory_transfer_id, product_id, product_code, product_name, line_number, quantity, unit_cost_ron, line_total_ron",
        )
        .eq("business_id", context.business.id)
        .order("line_number"),
    ]);

  if (error || lineError) {
    throw new Error("Unable to load inventory transfer history.");
  }

  const linesByTransfer = new Map<string, InventoryTransferLine[]>();
  for (const line of lineData) {
    if (
      !line.line_id ||
      !line.inventory_transfer_id ||
      !line.product_id ||
      !line.product_code ||
      !line.product_name ||
      line.line_number === null ||
      !line.quantity ||
      !line.unit_cost_ron ||
      !line.line_total_ron
    ) {
      throw new Error("Inventory transfer line data is incomplete.");
    }

    const mappedLine: InventoryTransferLine = {
      id: line.line_id,
      productId: line.product_id,
      productCode: line.product_code,
      productName: line.product_name,
      lineNumber: line.line_number,
      quantity: line.quantity,
      unitCostRon: line.unit_cost_ron,
      lineTotalRon: line.line_total_ron,
    };
    const existing = linesByTransfer.get(line.inventory_transfer_id) ?? [];
    existing.push(mappedLine);
    linesByTransfer.set(line.inventory_transfer_id, existing);
  }

  return data.map((row) => {
    if (
      !row.transfer_id ||
      !row.business_day_id ||
      !row.transfer_date ||
      !row.source_location_id ||
      !row.source_location_name ||
      !row.destination_location_id ||
      !row.destination_location_name ||
      row.amount_ron === null ||
      row.product_line_count === null ||
      !row.created_at ||
      (row.status !== "active" && row.status !== "reversed")
    ) {
      throw new Error("Inventory transfer data is incomplete.");
    }

    const lines = linesByTransfer.get(row.transfer_id) ?? [];

    if (lines.length !== row.product_line_count) {
      throw new Error("Inventory transfer line data is incomplete.");
    }

    return {
      id: row.transfer_id,
      businessDayId: row.business_day_id,
      transferDate: row.transfer_date,
      sourceLocationId: row.source_location_id,
      sourceLocationName: row.source_location_name,
      destinationLocationId: row.destination_location_id,
      destinationLocationName: row.destination_location_name,
      amountRon: row.amount_ron,
      notes: row.notes,
      entryOrigin: row.entry_origin ?? "operational",
      createdAt: row.created_at,
      status: row.status,
      recordMode: row.product_line_count > 0 ? "product_lines" : "value_only",
      lines,
    };
  });
}

export async function getInventoryTransferProductOptions(
  context: CurrentUserContext,
): Promise<readonly InventoryTransferProductOption[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("product_stock_by_location")
    .select("product_id, internal_code, product_name, location_id, quantity")
    .eq("business_id", context.business.id)
    .eq("product_is_active", true)
    .eq("location_type", "warehouse")
    .order("product_name");

  if (error) {
    throw new Error("Unable to load warehouse products.");
  }

  return data.flatMap((row) => {
    if (
      !row.product_id ||
      !row.internal_code ||
      !row.product_name ||
      !row.location_id ||
      row.quantity === null
    ) {
      throw new Error("Warehouse product data is incomplete.");
    }

    if (BigInt(row.quantity) <= BigInt(0)) {
      return [];
    }

    return [
      {
        id: row.product_id,
        internalCode: row.internal_code,
        name: row.product_name,
        warehouseLocationId: row.location_id,
        warehouseQuantity: row.quantity,
      },
    ];
  });
}

export async function createInventoryTransfer(
  context: CurrentUserContext,
  input: InventoryTransferInput,
): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "create_inventory_product_transfer",
    {
      target_business_id: context.business.id,
      target_business_day_id: input.businessDayId,
      target_source_location_id: input.sourceLocationId,
      target_destination_location_id: input.destinationLocationId,
      target_notes: input.notes ?? "",
      target_idempotency_key: input.idempotencyKey,
      target_lines: input.lines.map((line) => ({
        product_id: line.productId,
        quantity: line.quantity,
      })) as Json,
      target_audit_reason: input.auditReason ?? undefined,
    },
  );

  if (error || !data) {
    if (error?.message.includes("Insufficient warehouse quantity")) {
      throw new Error("A product exceeds its available warehouse quantity.");
    }

    if (error?.message.includes("Warehouse cost is unavailable")) {
      throw new Error(
        "A selected product has warehouse stock without a complete historical unit cost.",
      );
    }

    if (error?.message.includes("reused with different data")) {
      throw new Error("Transfer request identifier was already used.");
    }

    if (error?.message.includes("Historical transfers require")) {
      throw new Error("Enter an audit reason for a closed business day.");
    }

    if (error?.message.includes("current open business day")) {
      throw new Error("Employees can transfer inventory only on the open day.");
    }

    throw new Error("Inventory transfer could not be recorded.");
  }

  return data;
}

export async function reverseInventoryTransfer(
  context: CurrentUserContext,
  transferId: string,
  reason: string,
  allowNegativeStock: boolean,
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("reverse_inventory_value_transfer", {
    target_business_id: context.business.id,
    target_transfer_id: transferId,
    target_reason: reason,
    target_allow_negative_stock: allowNegativeStock,
  });

  if (error) {
    if (error.message.includes("already reversed")) {
      throw new Error("This inventory transfer is already reversed.");
    }

    if (error.message.includes("exceeds source inventory value")) {
      throw new Error(
        "The shop no longer has enough value to reverse this transfer.",
      );
    }

    if (error.message.includes("make product quantity negative")) {
      throw new Error(
        "The shop no longer has enough product quantity. Enable the documented administrator override only if the physical count requires it.",
      );
    }

    throw new Error("Inventory transfer could not be reversed.");
  }
}

export async function getInventoryStocktakes(
  context: CurrentUserContext,
  limit = 100,
): Promise<readonly InventoryStocktake[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("inventory_stocktake_summaries")
    .select(
      "stocktake_id, stocktake_date, warehouse_expected_value_ron, warehouse_actual_value_ron, warehouse_difference_ron, shop_expected_value_ron, shop_actual_value_ron, shop_difference_ron, reason, notes, created_at, status, reversed_at, reversal_reason",
    )
    .eq("business_id", context.business.id)
    .order("stocktake_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error("Unable to load inventory stocktake history.");
  }

  return data.map((row) => {
    if (
      !row.stocktake_id ||
      !row.stocktake_date ||
      row.warehouse_expected_value_ron === null ||
      row.warehouse_actual_value_ron === null ||
      row.warehouse_difference_ron === null ||
      row.shop_expected_value_ron === null ||
      row.shop_actual_value_ron === null ||
      row.shop_difference_ron === null ||
      !row.reason ||
      !row.created_at ||
      (row.status !== "active" && row.status !== "reversed")
    ) {
      throw new Error("Inventory stocktake data is incomplete.");
    }

    return {
      id: row.stocktake_id,
      stocktakeDate: row.stocktake_date,
      warehouseExpectedValueRon: row.warehouse_expected_value_ron,
      warehouseActualValueRon: row.warehouse_actual_value_ron,
      warehouseDifferenceRon: row.warehouse_difference_ron,
      shopExpectedValueRon: row.shop_expected_value_ron,
      shopActualValueRon: row.shop_actual_value_ron,
      shopDifferenceRon: row.shop_difference_ron,
      reason: row.reason,
      notes: row.notes,
      createdAt: row.created_at,
      status: row.status,
      reversedAt: row.reversed_at,
      reversalReason: row.reversal_reason,
    };
  });
}

export async function createInventoryStocktake(
  context: CurrentUserContext,
  input: InventoryStocktakeInput,
): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_inventory_stocktake", {
    target_business_id: context.business.id,
    target_stocktake_date: input.stocktakeDate,
    target_warehouse_actual_value_ron: input.warehouseActualValueRon,
    target_shop_actual_value_ron: input.shopActualValueRon,
    target_reason: input.reason,
    target_notes: input.notes ?? "",
    target_idempotency_key: input.idempotencyKey,
  });

  if (error || !data) {
    throw new Error("Inventory stocktake could not be recorded.");
  }

  return data;
}

export async function reverseInventoryStocktake(
  context: CurrentUserContext,
  stocktakeId: string,
  reason: string,
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("reverse_inventory_stocktake", {
    target_business_id: context.business.id,
    target_stocktake_id: stocktakeId,
    target_reason: reason,
  });

  if (error) {
    if (error.message.includes("already reversed")) {
      throw new Error("This inventory stocktake is already reversed.");
    }

    if (error.message.includes("exceeds source inventory value")) {
      throw new Error(
        "Current inventory value is insufficient to reverse this stocktake.",
      );
    }

    throw new Error("Inventory stocktake could not be reversed.");
  }
}
