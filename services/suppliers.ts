import "server-only";

import type { CurrentUserContext } from "@/lib/auth/types";
import { createServerSupabaseClient } from "@/lib/db/server";
import type {
  SupplierInput,
  SupplierSearchInput,
  SupplierUpdateInput,
} from "@/lib/validation/suppliers";

export type Supplier = Readonly<{
  id: string;
  businessId: string;
  name: string;
  phone: string | null;
  notes: string | null;
  defaultCurrency: "RON" | "USD" | null;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}>;

type SupplierRow = Readonly<{
  id: string;
  business_id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  default_currency: "RON" | "USD" | null;
  is_active: boolean;
  created_at: string;
  created_by: string;
  updated_at: string;
}>;

function mapSupplier(row: SupplierRow): Supplier {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    phone: row.phone,
    notes: row.notes,
    defaultCurrency: row.default_currency,
    isActive: row.is_active,
    createdAt: row.created_at,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
  };
}

export async function searchSuppliers(
  context: CurrentUserContext,
  input: SupplierSearchInput,
): Promise<readonly Supplier[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("search_suppliers", {
    target_business_id: context.business.id,
    target_search_text: input.query || undefined,
    target_include_inactive: input.includeInactive,
    target_result_limit: 100,
  });

  if (error) {
    throw new Error("Unable to load suppliers.");
  }

  return data.map(mapSupplier);
}

export async function getSupplier(
  context: CurrentUserContext,
  supplierId: string,
): Promise<Supplier | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select(
      "id, business_id, name, phone, notes, default_currency, is_active, created_at, created_by, updated_at",
    )
    .eq("business_id", context.business.id)
    .eq("id", supplierId)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load supplier.");
  }

  return data ? mapSupplier(data) : null;
}

export async function createSupplier(
  context: CurrentUserContext,
  input: SupplierInput,
): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_supplier", {
    target_business_id: context.business.id,
    target_name: input.name,
    target_phone: input.phone ?? undefined,
    target_notes: input.notes ?? undefined,
    target_default_currency: input.defaultCurrency ?? undefined,
  });

  if (error || !data) {
    if (error?.code === "23505") {
      throw new Error(
        "An active supplier already has this name and phone number.",
      );
    }

    throw new Error("Supplier could not be created.");
  }

  return data;
}

export async function updateSupplier(
  context: CurrentUserContext,
  input: SupplierUpdateInput,
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("update_supplier", {
    target_business_id: context.business.id,
    target_supplier_id: input.supplierId,
    target_name: input.name,
    target_phone: input.phone ?? undefined,
    target_notes: input.notes ?? undefined,
    target_default_currency: input.defaultCurrency ?? undefined,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error(
        "An active supplier already has this name and phone number.",
      );
    }

    throw new Error("Supplier could not be updated.");
  }
}

export async function deactivateSupplier(
  context: CurrentUserContext,
  supplierId: string,
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("deactivate_supplier", {
    target_business_id: context.business.id,
    target_supplier_id: supplierId,
  });

  if (error) {
    if (error.code === "55000") {
      throw new Error("Supplier is already inactive.");
    }

    throw new Error("Supplier could not be deactivated.");
  }
}
