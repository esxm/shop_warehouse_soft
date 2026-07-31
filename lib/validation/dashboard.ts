import { z } from "zod";

import { parseBusinessDate } from "@/lib/date/business-date";
import { parseExchangeRate } from "@/lib/money/money";

export const usdRonReferenceRateSchema = z.object({
  rate: z
    .string()
    .trim()
    .transform((value, context) => {
      try {
        return parseExchangeRate(value);
      } catch (error) {
        context.addIssue({
          code: "custom",
          message:
            error instanceof Error
              ? error.message
              : "Enter a valid USD/RON reference rate.",
        });
        return z.NEVER;
      }
    }),
  effectiveDate: z
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
              : "Enter a valid reference rate date.",
        });
        return z.NEVER;
      }
    }),
});

export type UsdRonReferenceRateInput = z.output<
  typeof usdRonReferenceRateSchema
>;
