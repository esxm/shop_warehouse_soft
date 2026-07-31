import "server-only";

import type { CurrentUserContext } from "@/lib/auth/types";
import type { Json } from "@/lib/db/database.types";
import { createServerSupabaseClient } from "@/lib/db/server";
import type { SupplierPaymentInput } from "@/lib/validation/supplier-payments";

export type SupplierFinancialAccountOption = Readonly<{
  id: string;
  name: string;
  type: "cash" | "bank";
}>;

export type SupplierPaymentAllocation = Readonly<{
  id: string;
  paymentId: string;
  purchaseId: string;
  purchaseDate: string;
  currency: "RON" | "USD";
  allocatedOriginalAmount: string;
  historicalRonValue: string;
  actualRonValue: string;
  currencyGainLossRon: string;
}>;

export type SupplierPayment = Readonly<{
  id: string;
  businessDayId: string;
  supplierId: string;
  paymentDate: string;
  currency: "RON" | "USD";
  originalAmountPaid: string;
  paymentExchangeRate: string | null;
  actualAmountRon: string;
  currencyGainLossRon: string;
  financialAccountId: string;
  financialAccountName: string;
  financialAccountType: "cash" | "bank";
  notes: string | null;
  entryOrigin: string;
  allocationStrategy: "oldest_first" | "manual";
  createdAt: string;
  status: "active" | "reversed";
  reversedAt: string | null;
  reversalReason: string | null;
  allocations: readonly SupplierPaymentAllocation[];
}>;

export async function getSupplierFinancialAccountOptions(
  context: CurrentUserContext,
): Promise<readonly SupplierFinancialAccountOption[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("financial_accounts")
    .select("id, name, type")
    .eq("business_id", context.business.id)
    .eq("currency", "RON")
    .eq("is_active", true)
    .order("type");

  if (error) {
    throw new Error("Unable to load financial accounts.");
  }

  return data;
}

export async function getSupplierPayments(
  context: CurrentUserContext,
  supplierId: string,
  period?: Readonly<{ fromDate?: string | null; toDate?: string | null }>,
): Promise<readonly SupplierPayment[]> {
  const supabase = await createServerSupabaseClient();
  let paymentQuery = supabase
    .from("supplier_payment_summaries")
    .select(
      "payment_id, business_day_id, supplier_id, payment_date, currency, original_amount_paid, payment_exchange_rate, actual_amount_ron, currency_gain_loss_ron, financial_account_id, financial_account_name, financial_account_type, notes, entry_origin, allocation_strategy, created_at, reversed_at, reversal_reason, derived_status",
    )
    .eq("business_id", context.business.id)
    .eq("supplier_id", supplierId)
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (period?.fromDate) {
    paymentQuery = paymentQuery.gte("payment_date", period.fromDate);
  }

  if (period?.toDate) {
    paymentQuery = paymentQuery.lte("payment_date", period.toDate);
  }

  const [paymentResult, allocationResult] = await Promise.all([
    paymentQuery,
    supabase
      .from("supplier_payment_allocation_details")
      .select(
        "allocation_id, payment_id, purchase_id, purchase_date, currency, allocated_original_amount, historical_ron_value, actual_ron_value, currency_gain_loss_ron",
      )
      .eq("business_id", context.business.id)
      .eq("supplier_id", supplierId)
      .order("purchase_date"),
  ]);

  if (paymentResult.error || allocationResult.error) {
    throw new Error("Unable to load supplier payments.");
  }

  const allocationsByPayment = new Map<string, SupplierPaymentAllocation[]>();

  for (const row of allocationResult.data) {
    if (
      !row.allocation_id ||
      !row.payment_id ||
      !row.purchase_id ||
      !row.purchase_date ||
      !row.currency ||
      !row.allocated_original_amount ||
      !row.historical_ron_value ||
      !row.actual_ron_value ||
      row.currency_gain_loss_ron === null
    ) {
      throw new Error("Supplier payment-allocation data is incomplete.");
    }

    const allocation: SupplierPaymentAllocation = {
      id: row.allocation_id,
      paymentId: row.payment_id,
      purchaseId: row.purchase_id,
      purchaseDate: row.purchase_date,
      currency: row.currency,
      allocatedOriginalAmount: row.allocated_original_amount,
      historicalRonValue: row.historical_ron_value,
      actualRonValue: row.actual_ron_value,
      currencyGainLossRon: row.currency_gain_loss_ron,
    };
    const existing = allocationsByPayment.get(row.payment_id) ?? [];
    existing.push(allocation);
    allocationsByPayment.set(row.payment_id, existing);
  }

  return paymentResult.data.map((row) => {
    if (
      !row.payment_id ||
      !row.business_day_id ||
      !row.supplier_id ||
      !row.payment_date ||
      !row.currency ||
      !row.original_amount_paid ||
      !row.actual_amount_ron ||
      row.currency_gain_loss_ron === null ||
      !row.financial_account_id ||
      !row.financial_account_name ||
      (row.financial_account_type !== "cash" &&
        row.financial_account_type !== "bank") ||
      (row.allocation_strategy !== "oldest_first" &&
        row.allocation_strategy !== "manual") ||
      !row.created_at ||
      (row.derived_status !== "active" && row.derived_status !== "reversed")
    ) {
      throw new Error("Supplier payment data is incomplete.");
    }

    return {
      id: row.payment_id,
      businessDayId: row.business_day_id,
      supplierId: row.supplier_id,
      paymentDate: row.payment_date,
      currency: row.currency,
      originalAmountPaid: row.original_amount_paid,
      paymentExchangeRate: row.payment_exchange_rate,
      actualAmountRon: row.actual_amount_ron,
      currencyGainLossRon: row.currency_gain_loss_ron,
      financialAccountId: row.financial_account_id,
      financialAccountName: row.financial_account_name,
      financialAccountType: row.financial_account_type,
      notes: row.notes,
      entryOrigin: row.entry_origin ?? "operational",
      allocationStrategy: row.allocation_strategy,
      createdAt: row.created_at,
      status: row.derived_status,
      reversedAt: row.reversed_at,
      reversalReason: row.reversal_reason,
      allocations: allocationsByPayment.get(row.payment_id) ?? [],
    };
  });
}

export async function createSupplierPayment(
  context: CurrentUserContext,
  input: SupplierPaymentInput,
): Promise<string> {
  const manualAllocations: Json = input.manualAllocations.map((allocation) => ({
    purchase_id: allocation.purchaseId,
    amount_original: allocation.amountOriginal,
  }));
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_supplier_payment", {
    target_business_id: context.business.id,
    target_business_day_id: input.businessDayId,
    target_supplier_id: input.supplierId,
    target_currency: input.currency,
    target_original_amount_paid: input.originalAmountPaid,
    target_payment_exchange_rate: input.paymentExchangeRate ?? "",
    target_financial_account_id: input.financialAccountId,
    target_idempotency_key: input.idempotencyKey,
    target_notes: input.notes ?? undefined,
    target_allocation_strategy: input.allocationStrategy,
    target_manual_allocations: manualAllocations,
    target_audit_reason: input.auditReason ?? undefined,
  });

  if (error || !data) {
    if (error?.message.includes("exceeds outstanding")) {
      throw new Error("Payment exceeds the supplier outstanding balance.");
    }

    if (error?.message.includes("Historical payments require")) {
      throw new Error("Historical payments require an audit reason.");
    }

    if (error?.message.includes("current open business day")) {
      throw new Error("Employees must use the current open business day.");
    }

    if (error?.message.includes("Manual allocations must equal")) {
      throw new Error("Manual allocations must equal the payment amount.");
    }

    if (error?.message.includes("exceeds purchase outstanding")) {
      throw new Error(
        "A manual allocation exceeds the purchase outstanding balance.",
      );
    }

    if (error?.message.toLowerCase().includes("manual allocation")) {
      throw new Error("Manual supplier-payment allocations are invalid.");
    }

    if (error?.message.includes("reused with different data")) {
      throw new Error("Payment request identifier was already used.");
    }

    throw new Error("Supplier payment could not be recorded.");
  }

  return data;
}

export async function reverseSupplierPayment(
  context: CurrentUserContext,
  paymentId: string,
  reason: string,
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("reverse_supplier_payment", {
    target_business_id: context.business.id,
    target_payment_id: paymentId,
    target_reason: reason,
  });

  if (error) {
    if (error.code === "55000") {
      throw new Error("Supplier payment is already reversed or inconsistent.");
    }

    throw new Error("Supplier payment could not be reversed.");
  }
}
