import "server-only";

import type { CurrentUserContext } from "@/lib/auth/types";
import type { BusinessDate } from "@/lib/date/business-date";
import { createServerSupabaseClient } from "@/lib/db/server";
import {
  buildSupplierPayablesReport,
  type SupplierPayablePurchaseSource,
  type SupplierPayablesFilter,
  type SupplierPayablesReport,
} from "@/lib/reports/supplier-payables";

const pageSize = 1000;

export type SupplierPayableOption = Readonly<{
  id: string;
  name: string;
}>;

export type SupplierCurrentReferenceRate = Readonly<{
  rate: string;
  effectiveDate: string;
}>;

export type SupplierPayablesPageData = Readonly<{
  report: SupplierPayablesReport;
  suppliers: readonly SupplierPayableOption[];
  currentUsdRonRate: SupplierCurrentReferenceRate | null;
}>;

async function getSupplierOptions(
  context: CurrentUserContext,
): Promise<readonly SupplierPayableOption[]> {
  const supabase = await createServerSupabaseClient();
  const suppliers: SupplierPayableOption[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("suppliers")
      .select("id, name")
      .eq("business_id", context.business.id)
      .order("name")
      .order("id")
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error("Unable to load payables report suppliers.");
    }

    suppliers.push(...data);

    if (data.length < pageSize) {
      return suppliers;
    }

    offset += pageSize;
  }
}

export async function getSupplierCurrentUsdRonRate(
  context: CurrentUserContext,
  asOfDate: BusinessDate,
): Promise<SupplierCurrentReferenceRate | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("currency_reference_rate_summaries")
    .select("id, rate, effective_date")
    .eq("business_id", context.business.id)
    .eq("base_currency", "USD")
    .eq("quote_currency", "RON")
    .lte("effective_date", asOfDate)
    .order("effective_date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load the current USD/RON reference rate.");
  }

  if (!data) {
    return null;
  }

  if (data.rate === null || data.effective_date === null) {
    throw new Error("Current USD/RON reference rate data is incomplete.");
  }

  return {
    rate: data.rate,
    effectiveDate: data.effective_date,
  };
}

async function getPurchaseSources(
  context: CurrentUserContext,
  filter: SupplierPayablesFilter,
): Promise<readonly SupplierPayablePurchaseSource[]> {
  const supabase = await createServerSupabaseClient();
  const purchases: SupplierPayablePurchaseSource[] = [];
  let offset = 0;

  while (true) {
    let query = supabase
      .from("supplier_purchase_summaries")
      .select(
        "purchase_id, supplier_id, supplier_name, purchase_date, due_date, currency, original_amount, allocated_original_amount, remaining_original_amount, derived_status",
      )
      .eq("business_id", context.business.id)
      .order("purchase_date")
      .order("purchase_id")
      .range(offset, offset + pageSize - 1);

    if (filter.supplierId) {
      query = query.eq("supplier_id", filter.supplierId);
    }

    if (filter.currency !== "all") {
      query = query.eq("currency", filter.currency);
    }

    if (filter.dueFromDate) {
      query = query.gte("due_date", filter.dueFromDate);
    }

    if (filter.dueToDate) {
      query = query.lte("due_date", filter.dueToDate);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error("Unable to load supplier payables.");
    }

    for (const row of data) {
      if (
        !row.purchase_id ||
        !row.supplier_id ||
        !row.supplier_name ||
        !row.purchase_date ||
        !row.currency ||
        row.original_amount === null ||
        row.allocated_original_amount === null ||
        row.remaining_original_amount === null ||
        (row.derived_status !== "unpaid" &&
          row.derived_status !== "partial" &&
          row.derived_status !== "paid" &&
          row.derived_status !== "reversed")
      ) {
        throw new Error("Supplier payables report data is incomplete.");
      }

      purchases.push({
        purchaseId: row.purchase_id,
        supplierId: row.supplier_id,
        supplierName: row.supplier_name,
        purchaseDate: row.purchase_date,
        dueDate: row.due_date,
        currency: row.currency,
        originalAmount: row.original_amount,
        allocatedOriginalAmount: row.allocated_original_amount,
        remainingOriginalAmount: row.remaining_original_amount,
        status: row.derived_status,
      });
    }

    if (data.length < pageSize) {
      return purchases;
    }

    offset += pageSize;
  }
}

export async function getSupplierPayablesPageData(
  context: CurrentUserContext,
  filter: SupplierPayablesFilter,
  asOfDate: BusinessDate,
): Promise<SupplierPayablesPageData> {
  const [suppliers, currentUsdRonRate, purchases] = await Promise.all([
    getSupplierOptions(context),
    getSupplierCurrentUsdRonRate(context, asOfDate),
    getPurchaseSources(context, filter),
  ]);

  return {
    suppliers,
    currentUsdRonRate,
    report: buildSupplierPayablesReport(
      purchases,
      filter,
      currentUsdRonRate?.rate ?? null,
    ),
  };
}
