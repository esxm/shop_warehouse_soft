import "server-only";

import type { CurrentUserContext } from "@/lib/auth/types";
import { getTodayInBusinessTimeZone } from "@/lib/date/business-date";
import { createServerSupabaseClient } from "@/lib/db/server";
import {
  buildBusinessPosition,
  buildBusinessPositionTrend,
  type BusinessPosition,
  type BusinessPositionSnapshotInput,
  type BusinessPositionSnapshotSource,
  type BusinessPositionTrendPoint,
} from "@/lib/reports/business-position";

export type BusinessPositionRateOption = Readonly<{
  id: string;
  rate: string;
  effectiveDate: string;
}>;

export type BusinessPositionPageData = Readonly<{
  asOfDate: string;
  position: BusinessPosition;
  selectedUsdRonRate: string | null;
  rateOptions: readonly BusinessPositionRateOption[];
  trend: readonly BusinessPositionTrendPoint[];
}>;

function requireText(value: string | null, message: string): string {
  if (value === null) {
    throw new Error(message);
  }

  return value;
}

export async function getBusinessPositionPageData(
  context: CurrentUserContext,
  requestedUsdRonRate: string | null,
): Promise<BusinessPositionPageData> {
  const supabase = await createServerSupabaseClient();
  const asOfDate = getTodayInBusinessTimeZone(context.business.timezone);
  const [
    accountResult,
    inventoryResult,
    receivableResult,
    payableResult,
    rateResult,
    snapshotResult,
  ] = await Promise.all([
    supabase
      .from("financial_account_balances")
      .select("type, balance_ron")
      .eq("business_id", context.business.id),
    supabase
      .from("inventory_location_balances")
      .select("type, balance_ron")
      .eq("business_id", context.business.id),
    supabase
      .from("customer_receivable_balances")
      .select("outstanding_ron")
      .eq("business_id", context.business.id),
    supabase
      .from("supplier_payable_balances")
      .select("currency, outstanding_original_amount")
      .eq("business_id", context.business.id),
    supabase
      .from("currency_reference_rate_summaries")
      .select("id, rate, effective_date")
      .eq("business_id", context.business.id)
      .eq("base_currency", "USD")
      .eq("quote_currency", "RON")
      .lte("effective_date", asOfDate)
      .order("effective_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(100),
    supabase
      .from("business_position_snapshot_summaries")
      .select(
        "id, snapshot_date, warehouse_inventory_ron, shop_inventory_ron, cash_ron, bank_ron, customer_receivables_ron, supplier_payables_ron, supplier_payables_usd, usd_ron_rate, estimated_usd_payables_ron, estimated_supplier_payables_ron, total_assets_ron, net_business_value_ron, created_by, created_at",
      )
      .eq("business_id", context.business.id)
      .order("snapshot_date")
      .order("created_at")
      .order("id")
      .limit(1000),
  ]);

  if (
    accountResult.error ||
    inventoryResult.error ||
    receivableResult.error ||
    payableResult.error ||
    rateResult.error ||
    snapshotResult.error
  ) {
    throw new Error("Unable to load the business-position report.");
  }

  const rateOptions: BusinessPositionRateOption[] = rateResult.data.map(
    (row) => ({
      id: requireText(row.id, "Business-position rate data is incomplete."),
      rate: requireText(row.rate, "Business-position rate data is incomplete."),
      effectiveDate: requireText(
        row.effective_date,
        "Business-position rate data is incomplete.",
      ),
    }),
  );
  const selectedUsdRonRate =
    requestedUsdRonRate ?? rateOptions[0]?.rate ?? null;
  const creatorIds = [
    ...new Set(
      snapshotResult.data.flatMap((row) =>
        row.created_by ? [row.created_by] : [],
      ),
    ),
  ];
  const profileResult =
    creatorIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", creatorIds);

  if (profileResult.error) {
    throw new Error("Unable to load business-position snapshot users.");
  }

  const creatorNames = new Map(
    profileResult.data.map((profile) => [
      profile.id,
      profile.full_name ?? profile.id,
    ]),
  );
  const snapshots: BusinessPositionSnapshotSource[] = snapshotResult.data.map(
    (row) => {
      const createdBy = requireText(
        row.created_by,
        "Business-position snapshot data is incomplete.",
      );

      return {
        id: requireText(
          row.id,
          "Business-position snapshot data is incomplete.",
        ),
        snapshotDate: requireText(
          row.snapshot_date,
          "Business-position snapshot data is incomplete.",
        ),
        warehouseInventoryRon: requireText(
          row.warehouse_inventory_ron,
          "Business-position snapshot data is incomplete.",
        ),
        shopInventoryRon: requireText(
          row.shop_inventory_ron,
          "Business-position snapshot data is incomplete.",
        ),
        cashRon: requireText(
          row.cash_ron,
          "Business-position snapshot data is incomplete.",
        ),
        bankRon: requireText(
          row.bank_ron,
          "Business-position snapshot data is incomplete.",
        ),
        customerReceivablesRon: requireText(
          row.customer_receivables_ron,
          "Business-position snapshot data is incomplete.",
        ),
        supplierPayablesRon: requireText(
          row.supplier_payables_ron,
          "Business-position snapshot data is incomplete.",
        ),
        supplierPayablesUsd: requireText(
          row.supplier_payables_usd,
          "Business-position snapshot data is incomplete.",
        ),
        usdRonRate: row.usd_ron_rate,
        estimatedUsdPayablesRon: requireText(
          row.estimated_usd_payables_ron,
          "Business-position snapshot data is incomplete.",
        ),
        estimatedSupplierPayablesRon: requireText(
          row.estimated_supplier_payables_ron,
          "Business-position snapshot data is incomplete.",
        ),
        totalAssetsRon: requireText(
          row.total_assets_ron,
          "Business-position snapshot data is incomplete.",
        ),
        netBusinessValueRon: requireText(
          row.net_business_value_ron,
          "Business-position snapshot data is incomplete.",
        ),
        createdBy,
        createdByName: creatorNames.get(createdBy) ?? createdBy,
        createdAt: requireText(
          row.created_at,
          "Business-position snapshot data is incomplete.",
        ),
      };
    },
  );

  return {
    asOfDate,
    selectedUsdRonRate,
    rateOptions,
    position: buildBusinessPosition(
      {
        financialAccounts: accountResult.data.map((row) => ({
          type: requireText(
            row.type,
            "Business-position account data is incomplete.",
          ),
          balanceRon: requireText(
            row.balance_ron,
            "Business-position account data is incomplete.",
          ),
        })),
        inventoryLocations: inventoryResult.data.map((row) => ({
          type: requireText(
            row.type,
            "Business-position inventory data is incomplete.",
          ),
          balanceRon: requireText(
            row.balance_ron,
            "Business-position inventory data is incomplete.",
          ),
        })),
        receivables: receivableResult.data.map((row) => ({
          outstandingRon: requireText(
            row.outstanding_ron,
            "Business-position receivable data is incomplete.",
          ),
        })),
        payables: payableResult.data.map((row) => ({
          currency: requireText(
            row.currency,
            "Business-position payable data is incomplete.",
          ),
          outstandingOriginalAmount: requireText(
            row.outstanding_original_amount,
            "Business-position payable data is incomplete.",
          ),
        })),
      },
      selectedUsdRonRate,
    ),
    trend: buildBusinessPositionTrend(snapshots),
  };
}

export async function saveBusinessPositionSnapshot(
  context: CurrentUserContext,
  input: BusinessPositionSnapshotInput,
): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(
    "save_business_position_snapshot",
    {
      target_business_id: context.business.id,
      target_snapshot_date: input.snapshotDate,
      target_usd_ron_rate: input.usdRonRate ?? "",
    },
  );

  if (error || !data) {
    throw new Error(
      error?.message ?? "Business-position snapshot could not be saved.",
    );
  }

  return data;
}
