import "server-only";

import type { CurrentUserContext } from "@/lib/auth/types";
import type { Json } from "@/lib/db/database.types";
import { createServerSupabaseClient } from "@/lib/db/server";
import type { CustomerPaymentInput } from "@/lib/validation/customer-payments";

export type FinancialAccountOption = Readonly<{
  id: string;
  name: string;
  type: "cash" | "bank";
}>;

export type CustomerPaymentAllocation = Readonly<{
  id: string;
  paymentId: string;
  purchaseId: string;
  purchaseDate: string;
  amountRon: string;
}>;

export type CustomerPayment = Readonly<{
  id: string;
  businessDayId: string;
  customerId: string;
  paymentDate: string;
  amountRon: string;
  allocatedRon: string;
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
  allocations: readonly CustomerPaymentAllocation[];
}>;

export async function getFinancialAccountOptions(
  context: CurrentUserContext,
): Promise<readonly FinancialAccountOption[]> {
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

export async function getCustomerPayments(
  context: CurrentUserContext,
  customerId: string,
  period?: Readonly<{ fromDate: string; toDate: string }>,
): Promise<readonly CustomerPayment[]> {
  const supabase = await createServerSupabaseClient();
  let paymentQuery = supabase
    .from("customer_payment_summaries")
    .select(
      "payment_id, business_day_id, customer_id, payment_date, amount_ron, allocated_ron, financial_account_id, financial_account_name, financial_account_type, notes, entry_origin, allocation_strategy, created_at, reversed_at, reversal_reason, derived_status",
    )
    .eq("business_id", context.business.id)
    .eq("customer_id", customerId)
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (period) {
    paymentQuery = paymentQuery
      .gte("payment_date", period.fromDate)
      .lte("payment_date", period.toDate);
  }

  const [paymentResult, allocationResult] = await Promise.all([
    paymentQuery,
    supabase
      .from("customer_payment_allocation_details")
      .select(
        "allocation_id, payment_id, purchase_id, purchase_date, amount_ron",
      )
      .eq("business_id", context.business.id)
      .eq("customer_id", customerId)
      .order("purchase_date"),
  ]);

  if (paymentResult.error || allocationResult.error) {
    throw new Error("Unable to load customer payments.");
  }

  const allocationsByPayment = new Map<string, CustomerPaymentAllocation[]>();

  for (const row of allocationResult.data) {
    if (
      !row.allocation_id ||
      !row.payment_id ||
      !row.purchase_id ||
      !row.purchase_date ||
      !row.amount_ron
    ) {
      throw new Error("Customer payment-allocation data is incomplete.");
    }

    const allocation: CustomerPaymentAllocation = {
      id: row.allocation_id,
      paymentId: row.payment_id,
      purchaseId: row.purchase_id,
      purchaseDate: row.purchase_date,
      amountRon: row.amount_ron,
    };
    const existing = allocationsByPayment.get(row.payment_id) ?? [];
    existing.push(allocation);
    allocationsByPayment.set(row.payment_id, existing);
  }

  return paymentResult.data.map((row) => {
    if (
      !row.payment_id ||
      !row.business_day_id ||
      !row.customer_id ||
      !row.payment_date ||
      !row.amount_ron ||
      !row.allocated_ron ||
      !row.financial_account_id ||
      !row.financial_account_name ||
      (row.financial_account_type !== "cash" &&
        row.financial_account_type !== "bank") ||
      (row.allocation_strategy !== "oldest_first" &&
        row.allocation_strategy !== "manual") ||
      !row.created_at ||
      (row.derived_status !== "active" && row.derived_status !== "reversed")
    ) {
      throw new Error("Customer payment data is incomplete.");
    }

    return {
      id: row.payment_id,
      businessDayId: row.business_day_id,
      customerId: row.customer_id,
      paymentDate: row.payment_date,
      amountRon: row.amount_ron,
      allocatedRon: row.allocated_ron,
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

export async function createCustomerPayment(
  context: CurrentUserContext,
  input: CustomerPaymentInput,
): Promise<string> {
  const manualAllocations: Json = input.manualAllocations.map((allocation) => ({
    purchase_id: allocation.purchaseId,
    amount_ron: allocation.amountRon,
  }));
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_customer_payment", {
    target_business_id: context.business.id,
    target_business_day_id: input.businessDayId,
    target_customer_id: input.customerId,
    target_amount_ron: input.amountRon,
    target_financial_account_id: input.financialAccountId,
    target_idempotency_key: input.idempotencyKey,
    target_notes: input.notes ?? undefined,
    target_allocation_strategy: input.allocationStrategy,
    target_manual_allocations: manualAllocations,
    target_audit_reason: input.auditReason ?? undefined,
  });

  if (error || !data) {
    if (error?.message.includes("exceeds outstanding")) {
      throw new Error("Payment exceeds the customer outstanding balance.");
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
      throw new Error("Manual payment allocations are invalid.");
    }

    if (error?.message.includes("reused with different data")) {
      throw new Error("Payment request identifier was already used.");
    }

    throw new Error("Customer payment could not be recorded.");
  }

  return data;
}

export async function reverseCustomerPayment(
  context: CurrentUserContext,
  paymentId: string,
  reason: string,
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("reverse_customer_payment", {
    target_business_id: context.business.id,
    target_payment_id: paymentId,
    target_reason: reason,
  });

  if (error) {
    if (error.code === "55000") {
      throw new Error("Customer payment is already reversed or inconsistent.");
    }

    throw new Error("Customer payment could not be reversed.");
  }
}
