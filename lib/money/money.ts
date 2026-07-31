import Decimal from "decimal.js";

const FinancialDecimal = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -40,
  toExpPos: 40,
});

const MONEY_PATTERN = /^-?(?:0|[1-9]\d{0,15})(?:[.,]\d{1,2})?$/;
const EXCHANGE_RATE_PATTERN = /^(?:0|[1-9]\d{0,5})(?:[.,]\d{1,8})?$/;

declare const moneyAmountBrand: unique symbol;
declare const exchangeRateBrand: unique symbol;

export type MoneyAmount = string & {
  readonly [moneyAmountBrand]: "MoneyAmount";
};

export type ExchangeRate = string & {
  readonly [exchangeRateBrand]: "ExchangeRate";
};

export class MoneyInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyInputError";
  }
}

function normalizeDecimalSeparator(value: string): string {
  return value.replace(",", ".");
}

function decimalToMoney(value: Decimal): MoneyAmount {
  const normalized = value.isZero() ? new FinancialDecimal(0) : value;
  return normalized.toFixed(2) as MoneyAmount;
}

function moneyToDecimal(value: MoneyAmount): Decimal {
  return new FinancialDecimal(value);
}

export function parseMoneyInput(input: unknown): MoneyAmount {
  if (typeof input !== "string") {
    throw new MoneyInputError("Money must be entered as text.");
  }

  const trimmed = input.trim();

  if (!MONEY_PATTERN.test(trimmed)) {
    throw new MoneyInputError(
      "Enter a monetary amount with no grouping separators and at most two decimal places.",
    );
  }

  const value = new FinancialDecimal(normalizeDecimalSeparator(trimmed));

  if (!value.isFinite()) {
    throw new MoneyInputError("Enter a finite monetary amount.");
  }

  return decimalToMoney(value);
}

export function parseExchangeRate(input: unknown): ExchangeRate {
  if (typeof input !== "string") {
    throw new MoneyInputError("Exchange rate must be entered as text.");
  }

  const trimmed = input.trim();

  if (!EXCHANGE_RATE_PATTERN.test(trimmed)) {
    throw new MoneyInputError(
      "Enter a positive exchange rate with at most eight decimal places.",
    );
  }

  const value = new FinancialDecimal(normalizeDecimalSeparator(trimmed));

  if (!value.isFinite() || value.lessThanOrEqualTo(0)) {
    throw new MoneyInputError("Exchange rate must be greater than zero.");
  }

  return value.toFixed(value.decimalPlaces()) as ExchangeRate;
}

export function requirePositiveMoney(amount: MoneyAmount): MoneyAmount {
  if (moneyToDecimal(amount).lessThanOrEqualTo(0)) {
    throw new MoneyInputError("Amount must be greater than zero.");
  }

  return amount;
}

export function requireNonNegativeMoney(amount: MoneyAmount): MoneyAmount {
  if (moneyToDecimal(amount).isNegative() && !moneyToDecimal(amount).isZero()) {
    throw new MoneyInputError("Amount must be zero or greater.");
  }

  return amount;
}

export function addMoney(...amounts: readonly MoneyAmount[]): MoneyAmount {
  const total = amounts.reduce(
    (sum, amount) => sum.plus(moneyToDecimal(amount)),
    new FinancialDecimal(0),
  );

  return decimalToMoney(total);
}

export function subtractMoney(
  minuend: MoneyAmount,
  ...subtrahends: readonly MoneyAmount[]
): MoneyAmount {
  const result = subtrahends.reduce(
    (difference, amount) => difference.minus(moneyToDecimal(amount)),
    moneyToDecimal(minuend),
  );

  return decimalToMoney(result);
}

export function convertUsdToRon(
  usdAmount: MoneyAmount,
  exchangeRate: ExchangeRate,
): MoneyAmount {
  const converted = moneyToDecimal(usdAmount).times(
    new FinancialDecimal(exchangeRate),
  );

  return decimalToMoney(converted);
}

function groupDigits(value: string, separator: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}

function splitMoney(amount: MoneyAmount): {
  sign: string;
  integer: string;
  fraction: string;
} {
  const isNegative = amount.startsWith("-");
  const unsigned = isNegative ? amount.slice(1) : amount;
  const [integer, fraction] = unsigned.split(".");

  return {
    sign: isNegative ? "-" : "",
    integer,
    fraction,
  };
}

export function formatRON(amount: MoneyAmount): string {
  const { sign, integer, fraction } = splitMoney(amount);
  return `${sign}${groupDigits(integer, ".")},${fraction} RON`;
}

export function formatSignedRON(amount: MoneyAmount): string {
  if (amount === "0.00" || amount.startsWith("-")) {
    return formatRON(amount);
  }

  return `+${formatRON(amount)}`;
}

export function formatUSD(amount: MoneyAmount): string {
  const { sign, integer, fraction } = splitMoney(amount);
  return `USD ${sign}${groupDigits(integer, ",")}.${fraction}`;
}

export function moneyToDatabaseNumeric(amount: MoneyAmount): string {
  return amount;
}
