import {
  addMoney,
  convertUsdToRon,
  parseExchangeRate,
  parseMoneyInput,
  subtractMoney,
  type MoneyAmount,
} from "@/lib/money/money";

type RevenueSource = Readonly<{
  businessDate: string;
  totalSalesRon: string;
}>;

type TypedBalance = Readonly<{
  type: string;
  balanceRon: string;
}>;

type ProductInventorySource = Readonly<{
  inventoryValueRon: string;
  costIsComplete: boolean;
}>;

type ReceivableSource = Readonly<{
  outstandingRon: string;
}>;

type PayableSource = Readonly<{
  currency: string;
  outstandingOriginalAmount: string;
}>;

export type DashboardFormulaInput = Readonly<{
  today: string;
  revenues: readonly RevenueSource[];
  financialAccounts: readonly TypedBalance[];
  receivables: readonly ReceivableSource[];
  payables: readonly PayableSource[];
  productInventory: readonly ProductInventorySource[];
  usdRonRate: string | null;
}>;

export type DashboardMetrics = Readonly<{
  todayRevenueRon: MoneyAmount;
  currentMonthRevenueRon: MoneyAmount;
  cashBalanceRon: MoneyAmount;
  bankBalanceRon: MoneyAmount;
  customerReceivablesRon: MoneyAmount;
  supplierPayablesRon: MoneyAmount;
  supplierPayablesUsd: MoneyAmount;
  estimatedUsdPayablesRon: MoneyAmount | null;
  estimatedSupplierPayablesRon: MoneyAmount | null;
  productValuedInventoryRon: MoneyAmount;
  netBusinessValueRon: MoneyAmount | null;
  hasFinancialActivity: boolean;
}>;

const zero = () => parseMoneyInput("0");

function sumMoney(values: readonly string[]): MoneyAmount {
  return addMoney(...values.map(parseMoneyInput));
}

export function calculateDashboardMetrics(
  input: DashboardFormulaInput,
): DashboardMetrics {
  const monthPrefix = input.today.slice(0, 7);
  const todayRevenueRon = sumMoney(
    input.revenues
      .filter((revenue) => revenue.businessDate === input.today)
      .map((revenue) => revenue.totalSalesRon),
  );
  const currentMonthRevenueRon = sumMoney(
    input.revenues
      .filter((revenue) => revenue.businessDate.startsWith(monthPrefix))
      .map((revenue) => revenue.totalSalesRon),
  );
  const cashBalanceRon = sumMoney(
    input.financialAccounts
      .filter((account) => account.type === "cash")
      .map((account) => account.balanceRon),
  );
  const bankBalanceRon = sumMoney(
    input.financialAccounts
      .filter((account) => account.type === "bank")
      .map((account) => account.balanceRon),
  );
  const customerReceivablesRon = sumMoney(
    input.receivables.map((receivable) => receivable.outstandingRon),
  );
  const supplierPayablesRon = sumMoney(
    input.payables
      .filter((payable) => payable.currency === "RON")
      .map((payable) => payable.outstandingOriginalAmount),
  );
  const supplierPayablesUsd = sumMoney(
    input.payables
      .filter((payable) => payable.currency === "USD")
      .map((payable) => payable.outstandingOriginalAmount),
  );
  const productValuedInventoryRon = sumMoney(
    input.productInventory
      .filter((row) => row.costIsComplete)
      .map((row) => row.inventoryValueRon),
  );
  const hasUsdPayables = supplierPayablesUsd !== "0.00";
  const estimatedUsdPayablesRon = hasUsdPayables
    ? input.usdRonRate
      ? convertUsdToRon(
          supplierPayablesUsd,
          parseExchangeRate(input.usdRonRate),
        )
      : null
    : zero();
  const estimatedSupplierPayablesRon =
    estimatedUsdPayablesRon === null
      ? null
      : addMoney(supplierPayablesRon, estimatedUsdPayablesRon);
  const totalAssets = addMoney(
    cashBalanceRon,
    bankBalanceRon,
    customerReceivablesRon,
    productValuedInventoryRon,
  );
  const netBusinessValueRon =
    estimatedSupplierPayablesRon === null
      ? null
      : subtractMoney(totalAssets, estimatedSupplierPayablesRon);
  const hasFinancialActivity = [
    todayRevenueRon,
    currentMonthRevenueRon,
    cashBalanceRon,
    bankBalanceRon,
    customerReceivablesRon,
    supplierPayablesRon,
    supplierPayablesUsd,
    productValuedInventoryRon,
  ].some((amount) => amount !== "0.00");

  return {
    todayRevenueRon,
    currentMonthRevenueRon,
    cashBalanceRon,
    bankBalanceRon,
    customerReceivablesRon,
    supplierPayablesRon,
    supplierPayablesUsd,
    estimatedUsdPayablesRon,
    estimatedSupplierPayablesRon,
    productValuedInventoryRon,
    netBusinessValueRon,
    hasFinancialActivity,
  };
}
