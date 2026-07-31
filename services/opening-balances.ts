import "server-only";

import type { CurrentUserContext } from "@/lib/auth/types";
import type { Json } from "@/lib/db/database.types";
import { createServerSupabaseClient } from "@/lib/db/server";
import type { OpeningBalanceInput } from "@/lib/validation/opening-balances";

export type OpeningBalanceSummary = Readonly<{
  id: string;
  openingDate: string;
  cashBalanceRon: string;
  bankBalanceRon: string;
  warehouseInventoryRon: string;
  shopInventoryRon: string;
  customerReceivableCount: number;
  supplierPayableCount: number;
  createdAt: string;
}>;

export async function getOpeningBalanceSummary(
  context: CurrentUserContext,
): Promise<OpeningBalanceSummary | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("opening_balance_summaries")
    .select(
      "id, opening_date, cash_balance_ron, bank_balance_ron, warehouse_inventory_ron, shop_inventory_ron, customer_receivable_count, supplier_payable_count, created_at",
    )
    .eq("business_id", context.business.id)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load opening-balance status.");
  }

  if (
    !data?.id ||
    !data.opening_date ||
    data.cash_balance_ron === null ||
    data.bank_balance_ron === null ||
    data.warehouse_inventory_ron === null ||
    data.shop_inventory_ron === null ||
    data.customer_receivable_count === null ||
    data.supplier_payable_count === null ||
    !data.created_at
  ) {
    return null;
  }

  return {
    id: data.id,
    openingDate: data.opening_date,
    cashBalanceRon: data.cash_balance_ron,
    bankBalanceRon: data.bank_balance_ron,
    warehouseInventoryRon: data.warehouse_inventory_ron,
    shopInventoryRon: data.shop_inventory_ron,
    customerReceivableCount: data.customer_receivable_count,
    supplierPayableCount: data.supplier_payable_count,
    createdAt: data.created_at,
  };
}

export async function createOpeningBalance(
  context: CurrentUserContext,
  input: OpeningBalanceInput,
): Promise<string> {
  const customerReceivables: Json = input.customerReceivables.map(
    (receivable) => ({
      name: receivable.name,
      amount_ron: receivable.amountRon,
    }),
  );
  const supplierPayables: Json = input.supplierPayables.map((payable) => ({
    name: payable.name,
    currency: payable.currency,
    original_amount: payable.originalAmount,
    purchase_exchange_rate: payable.purchaseExchangeRate ?? null,
  }));

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_opening_balance", {
    target_business_id: context.business.id,
    target_opening_date: input.openingDate,
    target_cash_balance_ron: input.cashBalanceRon,
    target_bank_balance_ron: input.bankBalanceRon,
    target_warehouse_inventory_ron: input.warehouseInventoryRon,
    target_shop_inventory_ron: input.shopInventoryRon,
    target_customer_receivables: customerReceivables,
    target_supplier_payables: supplierPayables,
  });

  if (error || !data) {
    if (error?.code === "23505") {
      throw new Error("Opening balances have already been initialized.");
    }

    throw new Error("Opening balances could not be initialized.");
  }

  return data;
}

export async function reverseOpeningBalance(
  context: CurrentUserContext,
  input: Readonly<{ batchId: string; reason: string }>,
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("reverse_opening_balance", {
    target_business_id: context.business.id,
    target_batch_id: input.batchId,
    target_reason: input.reason,
  });

  if (error) {
    throw new Error("Opening balances could not be reversed.");
  }
}
