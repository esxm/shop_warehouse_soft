import "server-only";

import type { CurrentUserContext } from "@/lib/auth/types";
import type { Json } from "@/lib/db/database.types";
import { createServerSupabaseClient } from "@/lib/db/server";
import type { AuditLogFilter } from "@/lib/audit/audit-log";

const pageSize = 200;
const optionScanLimit = 5000;

export type AuditLogEntry = Readonly<{
  id: string;
  actorUserId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  previousData: Json | null;
  newData: Json | null;
  reason: string | null;
  createdAt: string;
  businessDate: string;
  entityHref: string | null;
}>;

export type AuditLogOption = Readonly<{
  value: string;
  label: string;
}>;

export type AuditLogPageData = Readonly<{
  entries: readonly AuditLogEntry[];
  users: readonly AuditLogOption[];
  actions: readonly string[];
  entityTypes: readonly string[];
  totalCount: number;
  isTruncated: boolean;
}>;

type AuditSourceRow = Readonly<{
  id: string | null;
  actor_user_id: string | null;
  actor_name: string | null;
  action: string | null;
  entity_type: string | null;
  entity_id: string | null;
  previous_data: Json | null;
  new_data: Json | null;
  reason: string | null;
  created_at: string | null;
  business_date: string | null;
}>;

function requireText(value: string | null, message: string): string {
  if (value === null) {
    throw new Error(message);
  }

  return value;
}

function idsForType(
  rows: readonly AuditSourceRow[],
  entityType: string,
): string[] {
  return [
    ...new Set(
      rows.flatMap((row) =>
        row.entity_type === entityType && row.entity_id ? [row.entity_id] : [],
      ),
    ),
  ];
}

async function getPartyLinks(
  context: CurrentUserContext,
  rows: readonly AuditSourceRow[],
): Promise<ReadonlyMap<string, string>> {
  const customerPurchaseIds = idsForType(rows, "customer_credit_purchase");
  const customerPaymentIds = idsForType(rows, "customer_payment");
  const supplierPurchaseIds = idsForType(rows, "supplier_purchase");
  const supplierPaymentIds = idsForType(rows, "supplier_payment");
  const supabase = await createServerSupabaseClient();
  const [
    customerPurchaseResult,
    customerPaymentResult,
    supplierPurchaseResult,
    supplierPaymentResult,
  ] = await Promise.all([
    customerPurchaseIds.length
      ? supabase
          .from("customer_credit_purchases")
          .select("id, customer_id")
          .eq("business_id", context.business.id)
          .in("id", customerPurchaseIds)
      : Promise.resolve({
          data: [] as { id: string; customer_id: string }[],
          error: null,
        }),
    customerPaymentIds.length
      ? supabase
          .from("customer_payments")
          .select("id, customer_id")
          .eq("business_id", context.business.id)
          .in("id", customerPaymentIds)
      : Promise.resolve({
          data: [] as { id: string; customer_id: string }[],
          error: null,
        }),
    supplierPurchaseIds.length
      ? supabase
          .from("supplier_purchases")
          .select("id, supplier_id")
          .eq("business_id", context.business.id)
          .in("id", supplierPurchaseIds)
      : Promise.resolve({
          data: [] as { id: string; supplier_id: string }[],
          error: null,
        }),
    supplierPaymentIds.length
      ? supabase
          .from("supplier_payments")
          .select("id, supplier_id")
          .eq("business_id", context.business.id)
          .in("id", supplierPaymentIds)
      : Promise.resolve({
          data: [] as { id: string; supplier_id: string }[],
          error: null,
        }),
  ]);

  if (
    customerPurchaseResult.error ||
    customerPaymentResult.error ||
    supplierPurchaseResult.error ||
    supplierPaymentResult.error
  ) {
    throw new Error("Unable to resolve audit-log record links.");
  }

  return new Map([
    ...customerPurchaseResult.data.map(
      (row) =>
        [
          `customer_credit_purchase:${row.id}`,
          `/customers/${row.customer_id}#customer-credit-purchase-${row.id}`,
        ] as const,
    ),
    ...customerPaymentResult.data.map(
      (row) =>
        [
          `customer_payment:${row.id}`,
          `/customers/${row.customer_id}#customer-payment-${row.id}`,
        ] as const,
    ),
    ...supplierPurchaseResult.data.map(
      (row) =>
        [
          `supplier_purchase:${row.id}`,
          `/suppliers/${row.supplier_id}#supplier-purchase-${row.id}`,
        ] as const,
    ),
    ...supplierPaymentResult.data.map(
      (row) =>
        [
          `supplier_payment:${row.id}`,
          `/suppliers/${row.supplier_id}#supplier-payment-${row.id}`,
        ] as const,
    ),
  ]);
}

function fallbackEntityHref(row: AuditSourceRow): string | null {
  if (!row.entity_id) {
    return null;
  }

  switch (row.entity_type) {
    case "customer":
      return `/customers/${row.entity_id}`;
    case "supplier":
      return `/suppliers/${row.entity_id}`;
    case "expense":
      return `/expenses#expense-${row.entity_id}`;
    case "inventory_transfer":
      return `/inventory-value#inventory-transfer-${row.entity_id}`;
    case "inventory_stocktake":
      return `/inventory-value#inventory-stocktake-${row.entity_id}`;
    case "business_day":
      return "/daily-sales";
    case "daily_sales":
    case "daily_sales_closure":
      return "/daily-sales";
    case "opening_balance_batch":
      return "/opening-balances";
    case "financial_account":
      return "/cash-and-bank";
    case "currency_reference_rate":
      return "/";
    case "business_position_snapshot":
      return "/reports/business-position";
    case "business_member":
      return "/users";
    default:
      return null;
  }
}

export async function getAuditLogPageData(
  context: CurrentUserContext,
  filter: AuditLogFilter,
): Promise<AuditLogPageData> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("audit_log_summaries")
    .select(
      "id, actor_user_id, actor_name, action, entity_type, entity_id, previous_data, new_data, reason, created_at, business_date",
      { count: "exact" },
    )
    .eq("business_id", context.business.id);

  if (filter.userId) {
    query = query.eq("actor_user_id", filter.userId);
  }
  if (filter.action) {
    query = query.eq("action", filter.action);
  }
  if (filter.entityType) {
    query = query.eq("entity_type", filter.entityType);
  }
  if (filter.fromDate) {
    query = query.gte("business_date", filter.fromDate);
  }
  if (filter.toDate) {
    query = query.lte("business_date", filter.toDate);
  }

  const [entryResult, optionResult] = await Promise.all([
    query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(0, pageSize - 1),
    supabase
      .from("audit_log_summaries")
      .select("actor_user_id, actor_name, action, entity_type")
      .eq("business_id", context.business.id)
      .order("created_at", { ascending: false })
      .limit(optionScanLimit),
  ]);

  if (entryResult.error || optionResult.error) {
    throw new Error("Unable to load the audit log.");
  }

  const partyLinks = await getPartyLinks(context, entryResult.data);
  const usersById = new Map<string, string>();
  const actions = new Set<string>();
  const entityTypes = new Set<string>();

  for (const option of optionResult.data) {
    if (option.actor_user_id && option.actor_name) {
      usersById.set(option.actor_user_id, option.actor_name);
    }
    if (option.action) {
      actions.add(option.action);
    }
    if (option.entity_type) {
      entityTypes.add(option.entity_type);
    }
  }

  const entries = entryResult.data.map((row) => {
    const entityType = requireText(
      row.entity_type,
      "Audit-log data is incomplete.",
    );
    const entityHref =
      (row.entity_id
        ? partyLinks.get(`${entityType}:${row.entity_id}`)
        : undefined) ?? fallbackEntityHref(row);

    return {
      id: requireText(row.id, "Audit-log data is incomplete."),
      actorUserId: requireText(
        row.actor_user_id,
        "Audit-log data is incomplete.",
      ),
      actorName: requireText(row.actor_name, "Audit-log data is incomplete."),
      action: requireText(row.action, "Audit-log data is incomplete."),
      entityType,
      entityId: row.entity_id,
      previousData: row.previous_data,
      newData: row.new_data,
      reason: row.reason,
      createdAt: requireText(row.created_at, "Audit-log data is incomplete."),
      businessDate: requireText(
        row.business_date,
        "Audit-log data is incomplete.",
      ),
      entityHref,
    };
  });
  const totalCount = entryResult.count ?? entries.length;

  return {
    entries,
    users: [...usersById.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort(
        (left, right) =>
          left.label.localeCompare(right.label) ||
          left.value.localeCompare(right.value),
      ),
    actions: [...actions].sort(),
    entityTypes: [...entityTypes].sort(),
    totalCount,
    isTruncated: totalCount > pageSize,
  };
}
