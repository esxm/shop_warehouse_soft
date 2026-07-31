import "server-only";

import type { CurrentUserContext } from "@/lib/auth/types";
import { createServerSupabaseClient } from "@/lib/db/server";
import { parseMoneyInput } from "@/lib/money/money";
import {
  buildCashBankReport,
  type CashBankAccountSource,
  type CashBankLedgerSource,
  type CashBankReport,
  type CashBankReportFilter,
} from "@/lib/reports/cash-bank";

const pageSize = 1000;

export type CashBankReportPageData = Readonly<{
  report: CashBankReport;
  accounts: readonly CashBankAccountSource[];
}>;

type RawLedgerEntry = Readonly<{
  entry_id: string;
  financial_account_id: string;
  financial_account_name: string;
  financial_account_type: "cash" | "bank";
  entry_date: string;
  direction: "inflow" | "outflow";
  amount_ron: string;
  entry_type: string;
  source_entity_type: string;
  source_entity_id: string;
  description: string | null;
  created_by: string;
  created_at: string;
  reversal_of_id: string | null;
}>;

async function getAccounts(
  context: CurrentUserContext,
): Promise<readonly CashBankAccountSource[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("financial_account_balances")
    .select("financial_account_id, name, type, balance_ron")
    .eq("business_id", context.business.id)
    .order("type")
    .order("financial_account_id");

  if (error) {
    throw new Error("Unable to load cash and bank report accounts.");
  }

  return data.map((row) => {
    if (
      !row.financial_account_id ||
      !row.name ||
      !row.type ||
      row.balance_ron === null
    ) {
      throw new Error("Cash and bank report account data is incomplete.");
    }

    return {
      id: row.financial_account_id,
      name: row.name,
      type: row.type,
      balanceRon: row.balance_ron,
    };
  });
}

async function getRawEntries(
  context: CurrentUserContext,
): Promise<readonly RawLedgerEntry[]> {
  const supabase = await createServerSupabaseClient();
  const entries: RawLedgerEntry[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("financial_account_entry_summaries")
      .select(
        "entry_id, financial_account_id, financial_account_name, financial_account_type, entry_date, direction, amount_ron, entry_type, source_entity_type, source_entity_id, description, created_by, created_at, reversal_of_id",
      )
      .eq("business_id", context.business.id)
      .order("entry_date")
      .order("created_at")
      .order("entry_id")
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error("Unable to load cash and bank report entries.");
    }

    for (const row of data) {
      if (
        !row.entry_id ||
        !row.financial_account_id ||
        !row.financial_account_name ||
        !row.financial_account_type ||
        !row.entry_date ||
        !row.direction ||
        row.amount_ron === null ||
        !row.entry_type ||
        !row.source_entity_type ||
        !row.source_entity_id ||
        !row.created_by ||
        !row.created_at
      ) {
        throw new Error("Cash and bank ledger data is incomplete.");
      }

      entries.push({
        entry_id: row.entry_id,
        financial_account_id: row.financial_account_id,
        financial_account_name: row.financial_account_name,
        financial_account_type: row.financial_account_type,
        entry_date: row.entry_date,
        direction: row.direction,
        amount_ron: row.amount_ron,
        entry_type: row.entry_type,
        source_entity_type: row.source_entity_type,
        source_entity_id: row.source_entity_id,
        description: row.description,
        created_by: row.created_by,
        created_at: row.created_at,
        reversal_of_id: row.reversal_of_id,
      });
    }

    if (data.length < pageSize) {
      return entries;
    }

    offset += pageSize;
  }
}

async function getCreatorNames(
  context: CurrentUserContext,
  userIds: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", [...new Set(userIds)]);

  if (error) {
    throw new Error("Unable to load cash and bank report users.");
  }

  return new Map(
    data.map((profile) => [profile.id, profile.full_name ?? profile.id]),
  );
}

async function getPartySourceLinks(
  context: CurrentUserContext,
  entries: readonly RawLedgerEntry[],
): Promise<ReadonlyMap<string, string>> {
  const customerPaymentIds = [
    ...new Set(
      entries
        .filter((entry) => entry.source_entity_type === "customer_payment")
        .map((entry) => entry.source_entity_id),
    ),
  ];
  const supplierPaymentIds = [
    ...new Set(
      entries
        .filter((entry) => entry.source_entity_type === "supplier_payment")
        .map((entry) => entry.source_entity_id),
    ),
  ];
  const supabase = await createServerSupabaseClient();
  const [customerResult, supplierResult] = await Promise.all([
    customerPaymentIds.length
      ? supabase
          .from("customer_payments")
          .select("id, customer_id")
          .eq("business_id", context.business.id)
          .in("id", customerPaymentIds)
      : Promise.resolve({ data: [], error: null }),
    supplierPaymentIds.length
      ? supabase
          .from("supplier_payments")
          .select("id, supplier_id")
          .eq("business_id", context.business.id)
          .in("id", supplierPaymentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (customerResult.error || supplierResult.error) {
    throw new Error("Unable to resolve cash and bank source links.");
  }

  return new Map([
    ...customerResult.data.map(
      (payment) =>
        [
          `customer_payment:${payment.id}`,
          `/customers/${payment.customer_id}#customer-payment-${payment.id}`,
        ] as const,
    ),
    ...supplierResult.data.map(
      (payment) =>
        [
          `supplier_payment:${payment.id}`,
          `/suppliers/${payment.supplier_id}#supplier-payment-${payment.id}`,
        ] as const,
    ),
  ]);
}

function fallbackSourceHref(entry: RawLedgerEntry): string {
  switch (entry.source_entity_type) {
    case "opening_balance_batch":
      return "/opening-balances";
    case "daily_sales_closure":
      return `/daily-sales#daily-sales-closure-${entry.source_entity_id}`;
    case "expense":
      return `/expenses#expense-${entry.source_entity_id}`;
    default:
      return "/cash-and-bank";
  }
}

export async function getCashBankReportPageData(
  context: CurrentUserContext,
  filter: CashBankReportFilter,
): Promise<CashBankReportPageData> {
  const [accounts, rawEntries] = await Promise.all([
    getAccounts(context),
    getRawEntries(context),
  ]);
  const [creatorNames, partySourceLinks] = await Promise.all([
    getCreatorNames(
      context,
      rawEntries.map((entry) => entry.created_by),
    ),
    getPartySourceLinks(context, rawEntries),
  ]);
  const entries: CashBankLedgerSource[] = rawEntries.map((entry) => ({
    id: entry.entry_id,
    accountId: entry.financial_account_id,
    accountName: entry.financial_account_name,
    accountType: entry.financial_account_type,
    entryDate: entry.entry_date,
    direction: entry.direction,
    amountRon: entry.amount_ron,
    entryType: entry.entry_type,
    description: entry.description,
    sourceEntityType: entry.source_entity_type,
    sourceEntityId: entry.source_entity_id,
    sourceHref:
      partySourceLinks.get(
        `${entry.source_entity_type}:${entry.source_entity_id}`,
      ) ?? fallbackSourceHref(entry),
    createdBy: entry.created_by,
    createdByName: creatorNames.get(entry.created_by) ?? entry.created_by,
    createdAt: entry.created_at,
    reversalOfId: entry.reversal_of_id,
  }));
  const report = buildCashBankReport(entries, filter, accounts);

  for (const accountReport of report.accounts) {
    const storedViewBalance = accounts.find(
      (account) => account.id === accountReport.accountId,
    )?.balanceRon;

    if (
      storedViewBalance === undefined ||
      parseMoneyInput(storedViewBalance) !== accountReport.currentBalanceRon
    ) {
      throw new Error("Cash and bank report does not reconcile.");
    }
  }

  return { accounts, report };
}
