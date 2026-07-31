import "server-only";

import type { CurrentUserContext } from "@/lib/auth/types";
import type { Json } from "@/lib/db/database.types";
import { createServerSupabaseClient } from "@/lib/db/server";
import type {
  ProductCategoryInput,
  ProductCategoryUpdateInput,
  ProductInput,
  ProductSearchInput,
  ProductUpdateInput,
  ResolvedProductImportRow,
} from "@/lib/validation/products";

export type ProductCategory = Readonly<{
  id: string;
  businessId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}>;

export type Product = Readonly<{
  id: string;
  businessId: string;
  internalCode: string;
  name: string;
  categoryId: string;
  categoryName: string;
  unit: "piece";
  defaultPurchaseCostRon: string | null;
  defaultPurchaseCostOriginal: string | null;
  defaultPurchaseCurrency: "RON" | "USD";
  defaultPurchaseExchangeRate: string | null;
  defaultSellingPriceRon: string | null;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}>;

type ProductSearchRow = Readonly<{
  id: string;
  business_id: string;
  internal_code: string;
  name: string;
  category_id: string;
  category_name: string;
  unit: string;
  default_purchase_cost_ron: string | null;
  default_purchase_cost_original?: string | null;
  default_purchase_currency?: "RON" | "USD";
  default_purchase_exchange_rate?: string | null;
  default_selling_price_ron: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string;
  updated_at: string;
}>;

function mapProduct(row: ProductSearchRow): Product {
  if (row.unit !== "piece") {
    throw new Error("Product unit is invalid.");
  }

  return {
    id: row.id,
    businessId: row.business_id,
    internalCode: row.internal_code,
    name: row.name,
    categoryId: row.category_id,
    categoryName: row.category_name,
    unit: row.unit,
    defaultPurchaseCostRon: row.default_purchase_cost_ron,
    defaultPurchaseCostOriginal:
      row.default_purchase_cost_original ?? row.default_purchase_cost_ron,
    defaultPurchaseCurrency: row.default_purchase_currency ?? "RON",
    defaultPurchaseExchangeRate: row.default_purchase_exchange_rate ?? null,
    defaultSellingPriceRon: row.default_selling_price_ron,
    isActive: row.is_active,
    createdAt: row.created_at,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
  };
}

export async function getProductCategories(
  context: CurrentUserContext,
  includeInactive = false,
): Promise<readonly ProductCategory[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("product_categories")
    .select("id, business_id, name, is_active, created_at, updated_at")
    .eq("business_id", context.business.id)
    .order("is_active", { ascending: false })
    .order("name");

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error("Unable to load product categories.");
  }

  return data.map((row) => ({
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function searchProducts(
  context: CurrentUserContext,
  input: ProductSearchInput,
): Promise<readonly Product[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("search_products", {
    target_business_id: context.business.id,
    target_category_id: input.categoryId ?? undefined,
    target_include_inactive: input.includeInactive,
    target_result_limit: 200,
    target_search_text: input.query || undefined,
  });

  if (error) {
    throw new Error("Unable to load products.");
  }

  return data.map(mapProduct);
}

export async function getProduct(
  context: CurrentUserContext,
  productId: string,
): Promise<Product | null> {
  const supabase = await createServerSupabaseClient();
  const { data: product, error } = await supabase
    .from("products")
    .select(
      "id, business_id, internal_code, name, category_id, unit, default_purchase_cost_ron, default_purchase_cost_original, default_purchase_currency, default_purchase_exchange_rate, default_selling_price_ron, is_active, created_at, created_by, updated_at",
    )
    .eq("business_id", context.business.id)
    .eq("id", productId)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load product.");
  }

  if (!product) {
    return null;
  }

  const { data: category, error: categoryError } = await supabase
    .from("product_categories")
    .select("name")
    .eq("business_id", context.business.id)
    .eq("id", product.category_id)
    .single();

  if (categoryError || !category) {
    throw new Error("Product category is unavailable.");
  }

  return mapProduct({
    ...product,
    category_name: category.name,
    default_purchase_cost_ron:
      product.default_purchase_cost_ron?.toString() ?? null,
    default_purchase_cost_original:
      product.default_purchase_cost_original?.toString() ?? null,
    default_purchase_exchange_rate:
      product.default_purchase_exchange_rate?.toString() ?? null,
    default_selling_price_ron:
      product.default_selling_price_ron?.toString() ?? null,
  });
}

export async function createProductCategory(
  context: CurrentUserContext,
  input: ProductCategoryInput,
): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_product_category", {
    target_business_id: context.business.id,
    target_name: input.name,
  });

  if (error || !data) {
    if (error?.code === "23505") {
      throw new Error("This product category already exists.");
    }
    throw new Error("Product category could not be created.");
  }

  return data;
}

export async function updateProductCategory(
  context: CurrentUserContext,
  input: ProductCategoryUpdateInput,
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("update_product_category", {
    target_business_id: context.business.id,
    target_category_id: input.categoryId,
    target_name: input.name,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("This product category already exists.");
    }
    throw new Error("Product category could not be updated.");
  }
}

export async function deactivateProductCategory(
  context: CurrentUserContext,
  categoryId: string,
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("deactivate_product_category", {
    target_business_id: context.business.id,
    target_category_id: categoryId,
  });

  if (error) {
    if (error.message.includes("active products")) {
      throw new Error("Deactivate this category's active products first.");
    }
    throw new Error("Product category could not be deactivated.");
  }
}

export async function createProduct(
  context: CurrentUserContext,
  input: ProductInput,
): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "create_product_with_cost_currency",
    {
      target_business_id: context.business.id,
      target_category_id: input.categoryId,
      target_default_purchase_cost: input.defaultPurchaseCostRon ?? "",
      target_default_purchase_currency: input.defaultPurchaseCurrency,
      target_default_purchase_exchange_rate:
        input.defaultPurchaseExchangeRate ?? "",
      target_default_selling_price_ron:
        input.defaultSellingPriceRon ?? undefined,
      target_internal_code: input.internalCode ?? "",
      target_name: input.name,
    },
  );

  if (error || !data) {
    if (error?.code === "23505") {
      throw new Error("This internal product code is already in use.");
    }
    throw new Error("Product could not be created.");
  }

  return data;
}

export async function updateProduct(
  context: CurrentUserContext,
  input: ProductUpdateInput,
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("update_product_with_cost_currency", {
    target_business_id: context.business.id,
    target_category_id: input.categoryId,
    target_default_purchase_cost: input.defaultPurchaseCostRon ?? "",
    target_default_purchase_currency: input.defaultPurchaseCurrency,
    target_default_purchase_exchange_rate:
      input.defaultPurchaseExchangeRate ?? "",
    target_default_selling_price_ron: input.defaultSellingPriceRon ?? undefined,
    target_internal_code: input.internalCode ?? "",
    target_name: input.name,
    target_product_id: input.productId,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("This internal product code is already in use.");
    }
    throw new Error("Product could not be updated.");
  }
}

export async function deactivateProduct(
  context: CurrentUserContext,
  productId: string,
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("deactivate_product", {
    target_business_id: context.business.id,
    target_product_id: productId,
  });

  if (error) {
    throw new Error("Product could not be deactivated.");
  }
}

export async function importProducts(
  context: CurrentUserContext,
  idempotencyKey: string,
  rows: readonly ResolvedProductImportRow[],
): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("import_products", {
    target_business_id: context.business.id,
    target_idempotency_key: idempotencyKey,
    target_rows: rows.map((row) => ({ ...row })) as Json,
  });

  if (error || data === null) {
    if (error?.code === "23505") {
      throw new Error(
        "The import contains an internal code already used by this business.",
      );
    }
    if (error?.message.includes("reused with different data")) {
      throw new Error("Product import request identifier was already used.");
    }
    throw new Error("Products could not be imported.");
  }

  return data;
}
