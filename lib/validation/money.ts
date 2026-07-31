import { z } from "zod";

import {
  MoneyInputError,
  parseExchangeRate,
  parseMoneyInput,
  requireNonNegativeMoney,
  requirePositiveMoney,
} from "@/lib/money/money";

function moneyIssue(
  context: z.RefinementCtx,
  error: unknown,
  fallback: string,
) {
  context.addIssue({
    code: "custom",
    message: error instanceof MoneyInputError ? error.message : fallback,
  });
}

export const moneyInputSchema = z.string().transform((input, context) => {
  try {
    return parseMoneyInput(input);
  } catch (error) {
    moneyIssue(context, error, "Enter a valid monetary amount.");
    return z.NEVER;
  }
});

export const positiveMoneyInputSchema = z
  .string()
  .transform((input, context) => {
    try {
      return requirePositiveMoney(parseMoneyInput(input));
    } catch (error) {
      moneyIssue(context, error, "Enter an amount greater than zero.");
      return z.NEVER;
    }
  });

export const nonNegativeMoneyInputSchema = z
  .string()
  .transform((input, context) => {
    try {
      return requireNonNegativeMoney(parseMoneyInput(input));
    } catch (error) {
      moneyIssue(context, error, "Enter an amount of zero or greater.");
      return z.NEVER;
    }
  });

export const exchangeRateInputSchema = z
  .string()
  .transform((input, context) => {
    try {
      return parseExchangeRate(input);
    } catch (error) {
      moneyIssue(context, error, "Enter a valid exchange rate.");
      return z.NEVER;
    }
  });
