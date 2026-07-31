import "server-only";

import type { CurrentUserContext } from "@/lib/auth/types";
import { createServerSupabaseClient } from "@/lib/db/server";
import {
  buildCustomerReceivablesReport,
  type CustomerReceivablePurchaseSource,
  type CustomerReceivablesFilter,
  type CustomerReceivablesReport,
} from "@/lib/reports/customer-receivables";
import type { BusinessDate } from "@/lib/date/business-date";

const pageSize = 1000;

export type CustomerReceivableOption = Readonly<{
  id: string;
  name: string;
}>;

export type CustomerReceivablesPageData = Readonly<{
  report: CustomerReceivablesReport;
  customers: readonly CustomerReceivableOption[];
}>;

async function getCustomerOptions(
  context: CurrentUserContext,
): Promise<readonly CustomerReceivableOption[]> {
  const supabase = await createServerSupabaseClient();
  const customers: CustomerReceivableOption[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name")
      .eq("business_id", context.business.id)
      .order("name")
      .order("id")
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error("Unable to load receivables report customers.");
    }

    customers.push(...data);

    if (data.length < pageSize) {
      return customers;
    }

    offset += pageSize;
  }
}

async function getPurchaseSources(
  context: CurrentUserContext,
  filter: CustomerReceivablesFilter,
  customerNames: ReadonlyMap<string, string>,
): Promise<readonly CustomerReceivablePurchaseSource[]> {
  const supabase = await createServerSupabaseClient();
  const purchases: CustomerReceivablePurchaseSource[] = [];
  let offset = 0;

  while (true) {
    let query = supabase
      .from("customer_credit_purchase_balances")
      .select(
        "purchase_id, customer_id, purchase_date, due_date, amount_ron, allocated_ron, remaining_ron, derived_status",
      )
      .eq("business_id", context.business.id)
      .order("purchase_date")
      .order("purchase_id")
      .range(offset, offset + pageSize - 1);

    if (filter.customerId) {
      query = query.eq("customer_id", filter.customerId);
    }

    if (filter.fromDate) {
      query = query.gte("purchase_date", filter.fromDate);
    }

    if (filter.toDate) {
      query = query.lte("purchase_date", filter.toDate);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error("Unable to load customer receivables.");
    }

    for (const row of data) {
      const customerName = row.customer_id
        ? customerNames.get(row.customer_id)
        : null;

      if (
        !row.purchase_id ||
        !row.customer_id ||
        !customerName ||
        !row.purchase_date ||
        row.amount_ron === null ||
        row.allocated_ron === null ||
        row.remaining_ron === null ||
        (row.derived_status !== "unpaid" &&
          row.derived_status !== "partial" &&
          row.derived_status !== "paid" &&
          row.derived_status !== "reversed")
      ) {
        throw new Error("Customer receivables report data is incomplete.");
      }

      purchases.push({
        purchaseId: row.purchase_id,
        customerId: row.customer_id,
        customerName,
        purchaseDate: row.purchase_date,
        dueDate: row.due_date,
        amountRon: row.amount_ron,
        allocatedRon: row.allocated_ron,
        remainingRon: row.remaining_ron,
        status: row.derived_status,
      });
    }

    if (data.length < pageSize) {
      return purchases;
    }

    offset += pageSize;
  }
}

export async function getCustomerReceivablesPageData(
  context: CurrentUserContext,
  filter: CustomerReceivablesFilter,
  asOfDate: BusinessDate,
): Promise<CustomerReceivablesPageData> {
  const customers = await getCustomerOptions(context);
  const customerNames = new Map(
    customers.map((customer) => [customer.id, customer.name]),
  );
  const purchases = await getPurchaseSources(context, filter, customerNames);

  return {
    customers,
    report: buildCustomerReceivablesReport(purchases, filter, asOfDate),
  };
}
