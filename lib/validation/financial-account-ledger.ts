import { z } from "zod";

import { parseBusinessDate } from "@/lib/date/business-date";

const nullableUuid = z
  .string()
  .trim()
  .transform((value, context) => {
    if (!value) {
      return null;
    }

    const result = z.uuid().safeParse(value);

    if (!result.success) {
      context.addIssue({
        code: "custom",
        message: "Account filter is invalid.",
      });
      return z.NEVER;
    }

    return result.data;
  });

const nullableBusinessDate = z
  .string()
  .trim()
  .transform((value, context) => {
    if (!value) {
      return null;
    }

    try {
      return parseBusinessDate(value);
    } catch {
      context.addIssue({
        code: "custom",
        message: "Enter a valid ledger date.",
      });
      return z.NEVER;
    }
  });

export const financialAccountLedgerFilterSchema = z
  .object({
    accountId: nullableUuid,
    fromDate: nullableBusinessDate,
    toDate: nullableBusinessDate,
  })
  .refine(
    (filter) =>
      !filter.fromDate || !filter.toDate || filter.fromDate <= filter.toDate,
    {
      message: "The start date must not be after the end date.",
      path: ["toDate"],
    },
  );

export type FinancialAccountLedgerFilter = z.output<
  typeof financialAccountLedgerFilterSchema
>;
