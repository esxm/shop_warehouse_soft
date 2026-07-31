import "server-only";

import type { CurrentUserContext } from "@/lib/auth/types";
import type { Enums } from "@/lib/db/database.types";
import { createServerSupabaseClient } from "@/lib/db/server";
import type {
  StockMovementInput,
  StockMovementReversalInput,
} from "@/lib/validation/stock-movements";

export type StockMovementType = Enums<"stock_movement_type">;

export type StockLocation = Readonly<{
  id: string;
  name: string;
  type: Enums<"inventory_location_type">;
  isActive: boolean;
}>;

export type ProductStockBalance = Readonly<{
  productId: string;
  productCode: string;
  productName: string;
  categoryId: string;
  categoryName: string;
  productIsActive: boolean;
  locationId: string;
  locationName: string;
  locationType: Enums<"inventory_location_type">;
  quantity: string;
}>;

export type StockMovement = Readonly<{
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  movementType: Enums<"stock_movement_type">;
  sourceLocationId: string | null;
  sourceLocationName: string | null;
  destinationLocationId: string | null;
  destinationLocationName: string | null;
  quantity: string;
  unitCostRon: string | null;
  unitCostUsd: string | null;
  originalUnitCost: string | null;
  costCurrency: "RON" | "USD" | null;
  exchangeRate: string | null;
  costSource: "manual_purchase" | "source_weighted_average" | null;
  businessDate: string | null;
  referenceType: string;
  referenceId: string;
  notes: string | null;
  createdBy: string;
  createdByName: string | null;
  createdAt: string;
  reversalOfId: string | null;
  reversalMovementId: string | null;
  negativeStockOverride: boolean;
  overrideReason: string | null;
  status: "active" | "reversed" | "reversal";
}>;

function requiredString(value: string | null, fieldName: string): string {
  if (!value) {
    throw new Error(`Stock ledger ${fieldName} is unavailable.`);
  }
  return value;
}

export async function getStockLocations(
  context: CurrentUserContext,
): Promise<readonly StockLocation[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("inventory_locations")
    .select("id, name, type, is_active")
    .eq("business_id", context.business.id)
    .order("is_active", { ascending: false })
    .order("type");

  if (error) {
    throw new Error("Unable to load inventory locations.");
  }

  return data.map((location) => ({
    id: location.id,
    name: location.name,
    type: location.type,
    isActive: location.is_active,
  }));
}

export async function getProductStockBalances(
  context: CurrentUserContext,
): Promise<readonly ProductStockBalance[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("product_stock_by_location")
    .select(
      "product_id, internal_code, product_name, category_id, category_name, product_is_active, location_id, location_name, location_type, quantity",
    )
    .eq("business_id", context.business.id)
    .order("product_name")
    .order("location_type");

  if (error) {
    throw new Error("Unable to load product stock balances.");
  }

  return data.map((row) => {
    if (!row.location_type || row.product_is_active === null) {
      throw new Error("Stock ledger balance is incomplete.");
    }

    return {
      productId: requiredString(row.product_id, "product"),
      productCode: requiredString(row.internal_code, "product code"),
      productName: requiredString(row.product_name, "product name"),
      categoryId: requiredString(row.category_id, "category"),
      categoryName: requiredString(row.category_name, "category name"),
      productIsActive: row.product_is_active,
      locationId: requiredString(row.location_id, "location"),
      locationName: requiredString(row.location_name, "location name"),
      locationType: row.location_type,
      quantity: row.quantity ?? "0",
    };
  });
}

export async function getStockMovements(
  context: CurrentUserContext,
  options: Readonly<{
    fromDate: string;
    toDate: string;
    movementTypes?: readonly StockMovementType[];
    limit?: number;
  }>,
): Promise<readonly StockMovement[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("stock_movement_summaries")
    .select(
      "movement_id, product_id, product_code, product_name, movement_type, source_location_id, source_location_name, destination_location_id, destination_location_name, quantity, unit_cost_ron, unit_cost_usd, business_date, reference_type, reference_id, notes, created_by, created_by_name, created_at, reversal_of_id, reversal_movement_id, negative_stock_override, override_reason, status",
    )
    .eq("business_id", context.business.id)
    .gte("business_date", options.fromDate)
    .lte("business_date", options.toDate);

  if (options.movementTypes && options.movementTypes.length > 0) {
    query = query.in("movement_type", [...options.movementTypes]);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 250);

  if (error) {
    throw new Error("Unable to load stock movement history.");
  }

  const movementIds = data.flatMap((row) =>
    row.movement_id ? [row.movement_id] : [],
  );
  const { data: costDetails, error: costError } =
    movementIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("stock_movement_cost_details")
          .select(
            "stock_movement_id, cost_currency, original_unit_cost, exchange_rate, cost_source",
          )
          .eq("business_id", context.business.id)
          .in("stock_movement_id", movementIds);

  if (costError) {
    throw new Error("Unable to load stock movement cost details.");
  }

  const costByMovement = new Map(
    costDetails.map((detail) => [detail.stock_movement_id, detail]),
  );

  return data.map((row) => {
    if (
      !row.movement_type ||
      !row.status ||
      !["active", "reversed", "reversal"].includes(row.status)
    ) {
      throw new Error("Stock movement history is incomplete.");
    }

    const movementId = requiredString(row.movement_id, "movement");
    const cost = costByMovement.get(movementId);
    return {
      id: movementId,
      productId: requiredString(row.product_id, "product"),
      productCode: requiredString(row.product_code, "product code"),
      productName: requiredString(row.product_name, "product name"),
      movementType: row.movement_type,
      sourceLocationId: row.source_location_id,
      sourceLocationName: row.source_location_name,
      destinationLocationId: row.destination_location_id,
      destinationLocationName: row.destination_location_name,
      quantity: row.quantity ?? "0",
      unitCostRon: row.unit_cost_ron,
      unitCostUsd: row.unit_cost_usd,
      originalUnitCost: cost?.original_unit_cost?.toString() ?? null,
      costCurrency: cost?.cost_currency ?? null,
      exchangeRate: cost?.exchange_rate?.toString() ?? null,
      costSource:
        cost?.cost_source === "manual_purchase" ||
        cost?.cost_source === "source_weighted_average"
          ? cost.cost_source
          : null,
      businessDate: row.business_date,
      referenceType: requiredString(row.reference_type, "reference type"),
      referenceId: requiredString(row.reference_id, "reference"),
      notes: row.notes,
      createdBy: requiredString(row.created_by, "creator"),
      createdByName: row.created_by_name,
      createdAt: requiredString(row.created_at, "creation time"),
      reversalOfId: row.reversal_of_id,
      reversalMovementId: row.reversal_movement_id,
      negativeStockOverride: row.negative_stock_override ?? false,
      overrideReason: row.override_reason,
      status: row.status as StockMovement["status"],
    };
  });
}

export async function createStockMovement(
  context: CurrentUserContext,
  input: StockMovementInput,
): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const movementType =
    input.entryType === "adjustment_in" || input.entryType === "adjustment_out"
      ? "adjustment"
      : input.entryType;
  const { data, error } = await supabase.rpc(
    "create_stock_movement_with_cost",
    {
      target_allow_negative: input.allowNegative,
      target_business_day_id: input.businessDayId,
      target_business_id: context.business.id,
      target_destination_location_id: input.destinationLocationId ?? undefined,
      target_idempotency_key: input.idempotencyKey,
      target_movement_type: movementType,
      target_notes: input.notes ?? undefined,
      target_override_reason: input.overrideReason ?? undefined,
      target_product_id: input.productId,
      target_quantity: input.quantity,
      target_reference_id: input.referenceId,
      target_reference_type: "manual_stock_entry",
      target_source_location_id: input.sourceLocationId ?? undefined,
      target_unit_cost: input.unitCost ?? undefined,
      target_unit_cost_currency: input.unitCostCurrency,
      target_exchange_rate: input.exchangeRate ?? undefined,
    },
  );

  if (error || !data) {
    if (error?.message.includes("make product quantity negative")) {
      throw new Error(
        "This movement would make stock negative. An administrator may enable the documented override.",
      );
    }
    if (error?.message.includes("reused with different data")) {
      throw new Error("This stock movement request was already used.");
    }
    if (error?.message.includes("inactive")) {
      throw new Error(error.message);
    }
    if (error?.message.includes("weighted average cost is unavailable")) {
      throw new Error(
        "The source location has stock without a complete cost. Correct its inbound cost before moving stock.",
      );
    }
    throw new Error("Stock movement could not be saved.");
  }

  return data;
}

export async function reverseStockMovement(
  context: CurrentUserContext,
  input: StockMovementReversalInput,
): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("reverse_stock_movement", {
    target_allow_negative: input.allowNegative,
    target_business_id: context.business.id,
    target_idempotency_key: input.idempotencyKey,
    target_movement_id: input.movementId,
    target_reason: input.reason,
  });

  if (error || !data) {
    if (error?.message.includes("make product quantity negative")) {
      throw new Error(
        "This reversal would make stock negative. Enable the documented override if the physical count requires it.",
      );
    }
    if (error?.message.includes("already reversed")) {
      throw new Error("This stock movement is already reversed.");
    }
    throw new Error("Stock movement could not be reversed.");
  }

  return data;
}
