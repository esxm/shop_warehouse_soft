import { z } from "zod";

import { nonNegativeMoneyInputSchema } from "@/lib/validation/money";

export const dailySalesDraftSchema = z.object({
  businessDayId: z.uuid("Business day is invalid."),
  cashSalesRon: nonNegativeMoneyInputSchema,
  bankSalesRon: nonNegativeMoneyInputSchema,
  creditSalesRon: nonNegativeMoneyInputSchema,
  notes: z
    .string()
    .trim()
    .max(500, "Notes must not exceed 500 characters.")
    .transform((notes) => notes || null),
});

export type DailySalesDraftInput = z.output<typeof dailySalesDraftSchema>;
