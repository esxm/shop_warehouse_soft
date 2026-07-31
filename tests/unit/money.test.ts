import { describe, expect, it } from "vitest";

import {
  addMoney,
  convertUsdToRon,
  formatRON,
  formatSignedRON,
  formatUSD,
  moneyToDatabaseNumeric,
  parseExchangeRate,
  parseMoneyInput,
  requireNonNegativeMoney,
  requirePositiveMoney,
  subtractMoney,
} from "@/lib/money/money";
import {
  exchangeRateInputSchema,
  moneyInputSchema,
  positiveMoneyInputSchema,
} from "@/lib/validation/money";

describe("money utilities", () => {
  it("parses plain decimal input into canonical two-decimal strings", () => {
    expect(parseMoneyInput("12")).toBe("12.00");
    expect(parseMoneyInput(" 12.3 ")).toBe("12.30");
    expect(parseMoneyInput("12,34")).toBe("12.34");
    expect(parseMoneyInput("-0")).toBe("0.00");
  });

  it.each([
    12,
    "",
    "1,000.00",
    "1.000,00",
    "1e3",
    "12.345",
    ".50",
    "0001.00",
    "12345678901234567.00",
    "Infinity",
    "NaN",
  ])("rejects invalid money input %j", (input) => {
    expect(() => parseMoneyInput(input)).toThrow();
  });

  it("adds decimal amounts without binary floating-point errors", () => {
    const left = parseMoneyInput("0.1");
    const right = parseMoneyInput("0.2");

    expect(addMoney(left, right)).toBe("0.30");
  });

  it("subtracts monetary values exactly and permits reversal results", () => {
    expect(
      subtractMoney(
        parseMoneyInput("100.00"),
        parseMoneyInput("30.25"),
        parseMoneyInput("70.00"),
      ),
    ).toBe("-0.25");
  });

  it("requires positive values where business input must be positive", () => {
    expect(requirePositiveMoney(parseMoneyInput("0.01"))).toBe("0.01");
    expect(() => requirePositiveMoney(parseMoneyInput("0"))).toThrow(
      "greater than zero",
    );
    expect(() => requirePositiveMoney(parseMoneyInput("-1"))).toThrow(
      "greater than zero",
    );
  });

  it("allows zero but rejects negatives for opening balances", () => {
    expect(requireNonNegativeMoney(parseMoneyInput("0"))).toBe("0.00");
    expect(requireNonNegativeMoney(parseMoneyInput("1.25"))).toBe("1.25");
    expect(() => requireNonNegativeMoney(parseMoneyInput("-0.01"))).toThrow(
      "zero or greater",
    );
  });

  it("parses only finite positive exchange rates", () => {
    expect(parseExchangeRate("4,6000")).toBe("4.6");
    expect(() => parseExchangeRate("0")).toThrow("greater than zero");
    expect(() => parseExchangeRate("-4.6")).toThrow();
    expect(() => parseExchangeRate("4.123456789")).toThrow();
  });

  it("converts USD to RON with explicit half-up cent rounding", () => {
    expect(
      convertUsdToRon(parseMoneyInput("1000"), parseExchangeRate("4.60")),
    ).toBe("4600.00");
    expect(
      convertUsdToRon(parseMoneyInput("0.01"), parseExchangeRate("4.555")),
    ).toBe("0.05");
  });

  it("formats RON and USD without converting through JavaScript numbers", () => {
    const positive = parseMoneyInput("1234567.8");
    const negative = parseMoneyInput("-1234.5");

    expect(formatRON(positive)).toBe("1.234.567,80 RON");
    expect(formatRON(negative)).toBe("-1.234,50 RON");
    expect(formatUSD(positive)).toBe("USD 1,234,567.80");
    expect(formatUSD(negative)).toBe("USD -1,234.50");
  });

  it("formats business results with an explicit sign", () => {
    expect(formatSignedRON(parseMoneyInput("90"))).toBe("+90,00 RON");
    expect(formatSignedRON(parseMoneyInput("-90"))).toBe("-90,00 RON");
    expect(formatSignedRON(parseMoneyInput("0"))).toBe("0,00 RON");
  });

  it("returns PostgreSQL numeric values as decimal strings", () => {
    expect(moneyToDatabaseNumeric(parseMoneyInput("25.4"))).toBe("25.40");
  });

  it("provides Zod schemas for external money and rate input", () => {
    expect(moneyInputSchema.parse("-2,5")).toBe("-2.50");
    expect(positiveMoneyInputSchema.parse("2,5")).toBe("2.50");
    expect(positiveMoneyInputSchema.safeParse("-2.5").success).toBe(false);
    expect(exchangeRateInputSchema.parse("4.60")).toBe("4.6");
    expect(exchangeRateInputSchema.safeParse("0").success).toBe(false);
  });
});
