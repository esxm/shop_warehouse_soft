import { z } from "zod";

import { parseBusinessDate, type BusinessDate } from "@/lib/date/business-date";
import {
  addMoney,
  convertUsdToRon,
  parseExchangeRate,
  parseMoneyInput,
  subtractMoney,
  type ExchangeRate,
  type MoneyAmount,
} from "@/lib/money/money";

type TypedBalanceSource = Readonly<{
  type: string;
  balanceRon: string;
}>;

type ReceivableSource = Readonly<{
  outstandingRon: string;
}>;

type PayableSource = Readonly<{
  currency: string;
  outstandingOriginalAmount: string;
}>;

export type BusinessPositionSource = Readonly<{
  financialAccounts: readonly TypedBalanceSource[];
  inventoryLocations: readonly TypedBalanceSource[];
  receivables: readonly ReceivableSource[];
  payables: readonly PayableSource[];
}>;

export type BusinessPosition = Readonly<{
  warehouseInventoryRon: MoneyAmount;
  shopInventoryRon: MoneyAmount;
  cashRon: MoneyAmount;
  bankRon: MoneyAmount;
  customerReceivablesRon: MoneyAmount;
  supplierPayablesRon: MoneyAmount;
  supplierPayablesUsd: MoneyAmount;
  usdRonRate: ExchangeRate | null;
  estimatedUsdPayablesRon: MoneyAmount | null;
  estimatedSupplierPayablesRon: MoneyAmount | null;
  totalAssetsRon: MoneyAmount;
  netBusinessValueRon: MoneyAmount | null;
  usesExchangeRateEstimate: boolean;
}>;

export type BusinessPositionSnapshotSource = Readonly<{
  id: string;
  snapshotDate: string;
  warehouseInventoryRon: string;
  shopInventoryRon: string;
  cashRon: string;
  bankRon: string;
  customerReceivablesRon: string;
  supplierPayablesRon: string;
  supplierPayablesUsd: string;
  usdRonRate: string | null;
  estimatedUsdPayablesRon: string;
  estimatedSupplierPayablesRon: string;
  totalAssetsRon: string;
  netBusinessValueRon: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}>;

export type BusinessPositionTrendPoint = Readonly<{
  id: string;
  snapshotDate: BusinessDate;
  position: BusinessPosition;
  changeFromPreviousRon: MoneyAmount | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}>;

const optionalRateSchema = z
  .string()
  .trim()
  .default("")
  .transform((value, context) => {
    if (!value) {
      return null;
    }

    try {
      return parseExchangeRate(value);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message:
          error instanceof Error
            ? error.message
            : "Enter a valid USD/RON rate.",
      });
      return z.NEVER;
    }
  });

export const businessPositionFilterSchema = z.object({
  usdRonRate: optionalRateSchema,
});

export const businessPositionSnapshotSchema = z.object({
  snapshotDate: z
    .string()
    .trim()
    .transform((value, context) => {
      try {
        return parseBusinessDate(value);
      } catch (error) {
        context.addIssue({
          code: "custom",
          message:
            error instanceof Error
              ? error.message
              : "Enter a valid snapshot date.",
        });
        return z.NEVER;
      }
    }),
  usdRonRate: optionalRateSchema,
});

export type BusinessPositionSnapshotInput = z.output<
  typeof businessPositionSnapshotSchema
>;

function sumMoney(values: readonly string[]): MoneyAmount {
  return addMoney(...values.map(parseMoneyInput));
}

function buildFromComponents(
  components: Readonly<{
    warehouseInventoryRon: string;
    shopInventoryRon: string;
    cashRon: string;
    bankRon: string;
    customerReceivablesRon: string;
    supplierPayablesRon: string;
    supplierPayablesUsd: string;
  }>,
  rateInput: string | null,
): BusinessPosition {
  const warehouseInventoryRon = parseMoneyInput(
    components.warehouseInventoryRon,
  );
  const shopInventoryRon = parseMoneyInput(components.shopInventoryRon);
  const cashRon = parseMoneyInput(components.cashRon);
  const bankRon = parseMoneyInput(components.bankRon);
  const customerReceivablesRon = parseMoneyInput(
    components.customerReceivablesRon,
  );
  const supplierPayablesRon = parseMoneyInput(components.supplierPayablesRon);
  const supplierPayablesUsd = parseMoneyInput(components.supplierPayablesUsd);
  const usdRonRate = rateInput ? parseExchangeRate(rateInput) : null;
  const usesExchangeRateEstimate = supplierPayablesUsd !== "0.00";
  const estimatedUsdPayablesRon = usesExchangeRateEstimate
    ? usdRonRate
      ? convertUsdToRon(supplierPayablesUsd, usdRonRate)
      : null
    : parseMoneyInput("0");
  const estimatedSupplierPayablesRon =
    estimatedUsdPayablesRon === null
      ? null
      : addMoney(supplierPayablesRon, estimatedUsdPayablesRon);
  const totalAssetsRon = addMoney(
    warehouseInventoryRon,
    shopInventoryRon,
    cashRon,
    bankRon,
    customerReceivablesRon,
  );
  const netBusinessValueRon =
    estimatedSupplierPayablesRon === null
      ? null
      : subtractMoney(totalAssetsRon, estimatedSupplierPayablesRon);

  return {
    warehouseInventoryRon,
    shopInventoryRon,
    cashRon,
    bankRon,
    customerReceivablesRon,
    supplierPayablesRon,
    supplierPayablesUsd,
    usdRonRate,
    estimatedUsdPayablesRon,
    estimatedSupplierPayablesRon,
    totalAssetsRon,
    netBusinessValueRon,
    usesExchangeRateEstimate,
  };
}

export function buildBusinessPosition(
  source: BusinessPositionSource,
  usdRonRateInput: string | null,
): BusinessPosition {
  return buildFromComponents(
    {
      warehouseInventoryRon: sumMoney(
        source.inventoryLocations
          .filter((location) => location.type === "warehouse")
          .map((location) => location.balanceRon),
      ),
      shopInventoryRon: sumMoney(
        source.inventoryLocations
          .filter((location) => location.type === "shop")
          .map((location) => location.balanceRon),
      ),
      cashRon: sumMoney(
        source.financialAccounts
          .filter((account) => account.type === "cash")
          .map((account) => account.balanceRon),
      ),
      bankRon: sumMoney(
        source.financialAccounts
          .filter((account) => account.type === "bank")
          .map((account) => account.balanceRon),
      ),
      customerReceivablesRon: sumMoney(
        source.receivables.map((receivable) => receivable.outstandingRon),
      ),
      supplierPayablesRon: sumMoney(
        source.payables
          .filter((payable) => payable.currency === "RON")
          .map((payable) => payable.outstandingOriginalAmount),
      ),
      supplierPayablesUsd: sumMoney(
        source.payables
          .filter((payable) => payable.currency === "USD")
          .map((payable) => payable.outstandingOriginalAmount),
      ),
    },
    usdRonRateInput,
  );
}

export function buildBusinessPositionTrend(
  snapshots: readonly BusinessPositionSnapshotSource[],
): readonly BusinessPositionTrendPoint[] {
  const ordered = [...snapshots].sort(
    (left, right) =>
      left.snapshotDate.localeCompare(right.snapshotDate) ||
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id),
  );
  let previousNet: MoneyAmount | null = null;

  return ordered.map((snapshot) => {
    const snapshotDate = parseBusinessDate(snapshot.snapshotDate);
    const position = buildFromComponents(snapshot, snapshot.usdRonRate);

    if (
      position.estimatedUsdPayablesRon !==
        parseMoneyInput(snapshot.estimatedUsdPayablesRon) ||
      position.estimatedSupplierPayablesRon !==
        parseMoneyInput(snapshot.estimatedSupplierPayablesRon) ||
      position.totalAssetsRon !== parseMoneyInput(snapshot.totalAssetsRon) ||
      position.netBusinessValueRon !==
        parseMoneyInput(snapshot.netBusinessValueRon)
    ) {
      throw new Error("Business-position snapshot is inconsistent.");
    }

    if (position.netBusinessValueRon === null) {
      throw new Error("Business-position snapshot is missing its estimate.");
    }

    const changeFromPreviousRon =
      previousNet === null
        ? null
        : subtractMoney(position.netBusinessValueRon, previousNet);
    previousNet = position.netBusinessValueRon;

    return {
      id: snapshot.id,
      snapshotDate,
      position,
      changeFromPreviousRon,
      createdBy: snapshot.createdBy,
      createdByName: snapshot.createdByName,
      createdAt: snapshot.createdAt,
    };
  });
}
