import { z } from "zod";

import { addMoney, type MoneyAmount } from "@/lib/money/money";
import {
  nonNegativeMoneyInputSchema,
  positiveMoneyInputSchema,
} from "@/lib/validation/money";
import {
  reversalConfirmationSchema,
  reversalReasonSchema,
} from "@/lib/validation/reversals";

export const productSaleLineSchema = z.object({
  productId: z.uuid("Select a valid product."),
  quantity: z
    .string()
    .trim()
    .regex(/^[1-9]\d{0,17}$/, "Quantity must be a positive whole number."),
  unitSellingPriceRon: positiveMoneyInputSchema,
});

export function parseProductSaleLines(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function moneyToCents(value: MoneyAmount): bigint {
  const [integer, fraction] = value.split(".");
  return BigInt(integer) * BigInt(100) + BigInt(fraction);
}

const optionalCustomerSchema = z
  .string()
  .trim()
  .transform((value) => value || null)
  .pipe(z.uuid("Customer is invalid.").nullable());

export const productSaleInputSchema = z
  .object({
    businessDayId: z.uuid("Business day is invalid."),
    shopLocationId: z.uuid("Shop location is invalid."),
    customerId: optionalCustomerSchema,
    cashAmountRon: nonNegativeMoneyInputSchema,
    bankAmountRon: nonNegativeMoneyInputSchema,
    creditAmountRon: nonNegativeMoneyInputSchema,
    idempotencyKey: z.uuid("Sale request identifier is invalid."),
    lines: z
      .array(productSaleLineSchema, {
        error: "Add valid product lines.",
      })
      .min(1, "Add at least one product.")
      .max(100, "A sale cannot exceed 100 product lines."),
    notes: z
      .string()
      .trim()
      .max(500, "Notes must not exceed 500 characters.")
      .transform((notes) => notes || null),
  })
  .superRefine((input, context) => {
    const productIds = new Set<string>();
    let saleTotalCents = BigInt(0);
    let linesAreCalculable = true;

    for (const line of input.lines) {
      if (productIds.has(line.productId)) {
        context.addIssue({
          code: "custom",
          message: "Each product may appear only once.",
          path: ["lines"],
        });
      }
      productIds.add(line.productId);
      if (
        /^[1-9]\d{0,17}$/.test(line.quantity) &&
        /^\d+\.\d{2}$/.test(line.unitSellingPriceRon)
      ) {
        saleTotalCents +=
          BigInt(line.quantity) * moneyToCents(line.unitSellingPriceRon);
      } else {
        linesAreCalculable = false;
      }
    }

    const paymentsAreCalculable = [
      input.cashAmountRon,
      input.bankAmountRon,
      input.creditAmountRon,
    ].every((amount) => /^\d+\.\d{2}$/.test(amount));

    if (
      linesAreCalculable &&
      paymentsAreCalculable &&
      moneyToCents(
        addMoney(
          input.cashAmountRon,
          input.bankAmountRon,
          input.creditAmountRon,
        ),
      ) !== saleTotalCents
    ) {
      context.addIssue({
        code: "custom",
        message: "Cash, bank, and credit must equal the sale total.",
        path: ["cashAmountRon"],
      });
    }

    if (input.creditAmountRon !== "0.00" && input.customerId === null) {
      context.addIssue({
        code: "custom",
        message: "Select a customer for the credit amount.",
        path: ["customerId"],
      });
    }

    if (input.creditAmountRon === "0.00" && input.customerId !== null) {
      context.addIssue({
        code: "custom",
        message: "A customer is used only when the sale includes credit.",
        path: ["customerId"],
      });
    }
  });

export const productSaleReversalSchema = z.object({
  saleId: z.uuid("Sale is invalid."),
  reason: reversalReasonSchema,
  confirmation: reversalConfirmationSchema(
    "Confirm that this sale should be reversed.",
  ),
});

export type ProductSaleInput = z.output<typeof productSaleInputSchema>;
