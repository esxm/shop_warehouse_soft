import "server-only";

import type { CurrentUserContext } from "@/lib/auth/types";
import { createServerSupabaseClient } from "@/lib/db/server";
import type {
  CustomerInput,
  CustomerSearchInput,
  CustomerUpdateInput,
} from "@/lib/validation/customers";

export type Customer = Readonly<{
  id: string;
  businessId: string;
  name: string;
  phone: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}>;

type CustomerRow = Readonly<{
  id: string;
  business_id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string;
  updated_at: string;
}>;

function mapCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    phone: row.phone,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: row.created_at,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
  };
}

export async function searchCustomers(
  context: CurrentUserContext,
  input: CustomerSearchInput,
): Promise<readonly Customer[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("search_customers", {
    target_business_id: context.business.id,
    target_search_text: input.query || undefined,
    target_include_inactive: input.includeInactive,
    target_result_limit: 100,
  });

  if (error) {
    throw new Error("Unable to load customers.");
  }

  return data.map(mapCustomer);
}

export async function getCustomer(
  context: CurrentUserContext,
  customerId: string,
): Promise<Customer | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("customers")
    .select(
      "id, business_id, name, phone, notes, is_active, created_at, created_by, updated_at",
    )
    .eq("business_id", context.business.id)
    .eq("id", customerId)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load customer.");
  }

  return data ? mapCustomer(data) : null;
}

export async function createCustomer(
  context: CurrentUserContext,
  input: CustomerInput,
): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_customer", {
    target_business_id: context.business.id,
    target_name: input.name,
    target_phone: input.phone ?? undefined,
    target_notes: input.notes ?? undefined,
  });

  if (error || !data) {
    if (error?.code === "23505") {
      throw new Error(
        "An active customer already has this name and phone number.",
      );
    }

    throw new Error("Customer could not be created.");
  }

  return data;
}

export async function updateCustomer(
  context: CurrentUserContext,
  input: CustomerUpdateInput,
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("update_customer", {
    target_business_id: context.business.id,
    target_customer_id: input.customerId,
    target_name: input.name,
    target_phone: input.phone ?? undefined,
    target_notes: input.notes ?? undefined,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error(
        "An active customer already has this name and phone number.",
      );
    }

    throw new Error("Customer could not be updated.");
  }
}

export async function deactivateCustomer(
  context: CurrentUserContext,
  customerId: string,
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("deactivate_customer", {
    target_business_id: context.business.id,
    target_customer_id: customerId,
  });

  if (error) {
    if (error.code === "55000") {
      throw new Error("Customer is already inactive.");
    }

    throw new Error("Customer could not be deactivated.");
  }
}
