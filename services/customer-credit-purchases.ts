import "server-only";

import Decimal from "decimal.js";

import type { CurrentUserContext } from "@/lib/auth/types";
import { createServerSupabaseClient } from "@/lib/db/server";
import { parseMoneyInput } from "@/lib/money/money";
import type { CustomerCreditPurchaseInput } from "@/lib/validation/customer-credit-purchases";
import { createProductSale } from "@/services/product-sales";

export type CustomerCreditPurchase = Readonly<{
  id: string;
  businessId: string;
  businessDayId: string | null;
  customerId: string;
  purchaseDate: string;
  amountRon: string;
  allocatedRon: string;
  remainingRon: string;
  status: "unpaid" | "partial" | "paid" | "reversed";
  description: string | null;
  dueDate: string | null;
  entryOrigin: string;
  createdAt: string;
  reversedAt: string | null;
  reversalReason: string | null;
}>;

type CustomerCreditPurchaseRow = Readonly<{
  purchase_id: string | null;
  business_id: string | null;
  business_day_id: string | null;
  customer_id: string | null;
  purchase_date: string | null;
  amount_ron: string | null;
  allocated_ron: string | null;
  remaining_ron: string | null;
  derived_status: string | null;
  description: string | null;
  due_date: string | null;
  entry_origin: string | null;
  created_at: string | null;
  reversed_at: string | null;
  reversal_reason: string | null;
}>;

function mapPurchase(row: CustomerCreditPurchaseRow): CustomerCreditPurchase {
  if (
    !row.purchase_id ||
    !row.business_id ||
    !row.customer_id ||
    !row.purchase_date ||
    !row.amount_ron ||
    !row.allocated_ron ||
    !row.remaining_ron ||
    !row.entry_origin ||
    !row.created_at ||
    (row.derived_status !== "unpaid" &&
      row.derived_status !== "partial" &&
      row.derived_status !== "paid" &&
      row.derived_status !== "reversed")
  ) {
    throw new Error("Customer credit-purchase data is incomplete.");
  }

  return {
    id: row.purchase_id,
    businessId: row.business_id,
    businessDayId: row.business_day_id,
    customerId: row.customer_id,
    purchaseDate: row.purchase_date,
    amountRon: row.amount_ron,
    allocatedRon: row.allocated_ron,
    remainingRon: row.remaining_ron,
    status: row.derived_status,
    description: row.description,
    dueDate: row.due_date,
    entryOrigin: row.entry_origin,
    createdAt: row.created_at,
    reversedAt: row.reversed_at,
    reversalReason: row.reversal_reason,
  };
}

export async function getCustomerCreditPurchases(
  context: CurrentUserContext,
  customerId: string,
  period?: Readonly<{ fromDate: string; toDate: string }>,
): Promise<readonly CustomerCreditPurchase[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("customer_credit_purchase_balances")
    .select(
      "purchase_id, business_id, business_day_id, customer_id, purchase_date, amount_ron, allocated_ron, remaining_ron, derived_status, description, due_date, entry_origin, created_at, reversed_at, reversal_reason",
    )
    .eq("business_id", context.business.id)
    .eq("customer_id", customerId)
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (period) {
    query = query
      .gte("purchase_date", period.fromDate)
      .lte("purchase_date", period.toDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error("Unable to load customer credit purchases.");
  }

  return data.map(mapPurchase);
}

export async function getCustomerReceivableBalance(
  context: CurrentUserContext,
  customerId: string,
): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("customer_receivable_balances")
    .select("outstanding_ron")
    .eq("business_id", context.business.id)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load customer receivable balance.");
  }

  return data?.outstanding_ron ?? "0.00";
}

export async function createCustomerCreditPurchase(
  context: CurrentUserContext,
  input: CustomerCreditPurchaseInput,
): Promise<string> {
  const exchangeRate = new Decimal(input.exchangeRate);
  const lines = input.lines.map((line) => {
    const originalPrice = new Decimal(line.unitSellingPriceOriginalCurrency);
    const unitSellingPriceRon =
      input.currency === "USD"
        ? originalPrice.times(exchangeRate).toFixed(2)
        : originalPrice.toFixed(2);

    return {
      productId: line.productId,
      quantity: line.quantity,
      unitSellingPriceRon: parseMoneyInput(unitSellingPriceRon),
    };
  });
  const creditAmountRon = lines
    .reduce(
      (total, line) =>
        total.plus(new Decimal(line.quantity).times(line.unitSellingPriceRon)),
      new Decimal(0),
    )
    .toFixed(2);
  const notes = [
    input.description,
    `Credit currency: ${input.currency}`,
    `USD/RON rate: ${input.exchangeRate}`,
    input.dueDate ? `Due date: ${input.dueDate}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return createProductSale(context, {
    businessDayId: input.businessDayId,
    shopLocationId: input.shopLocationId,
    customerId: input.customerId,
    cashAmountRon: parseMoneyInput("0.00"),
    bankAmountRon: parseMoneyInput("0.00"),
    creditAmountRon: parseMoneyInput(creditAmountRon),
    idempotencyKey: input.idempotencyKey,
    lines,
    notes,
  });
}

export async function reverseCustomerCreditPurchase(
  context: CurrentUserContext,
  purchaseId: string,
  reason: string,
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("reverse_customer_credit_purchase", {
    target_business_id: context.business.id,
    target_purchase_id: purchaseId,
    target_reason: reason,
  });

  if (error) {
    if (error.code === "55000") {
      throw new Error(
        "This purchase is already reversed or must use opening-balance reversal.",
      );
    }

    throw new Error("Customer credit purchase could not be reversed.");
  }
}
