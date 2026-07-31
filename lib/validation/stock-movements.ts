import { z } from "zod";

import {
  reversalConfirmationSchema,
  reversalReasonSchema,
} from "@/lib/validation/reversals";
import {
  exchangeRateInputSchema,
  positiveMoneyInputSchema,
} from "@/lib/validation/money";

export const stockMovementEntryTypeSchema = z.enum([
  "opening",
  "transfer",
  "return",
  "damage",
  "adjustment_in",
  "adjustment_out",
]);

const optionalUuidSchema = z.preprocess(
  (value) => value ?? "",
  z
    .string()
    .trim()
    .transform((value) => value || null)
    .pipe(z.uuid("Inventory location is invalid.").nullable()),
);

const optionalOverrideReasonSchema = z
  .string()
  .trim()
  .max(500, "Override reason must not exceed 500 characters.")
  .refine(
    (reason) => reason === "" || reason.length >= 10,
    "Override reason must contain at least 10 characters.",
  )
  .transform((reason) => reason || null);

const optionalPositiveMoneySchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  positiveMoneyInputSchema.optional(),
);

const optionalExchangeRateSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  exchangeRateInputSchema.optional(),
);

export const stockMovementInputSchema = z
  .object({
    productId: z.uuid("Product is invalid."),
    entryType: stockMovementEntryTypeSchema,
    sourceLocationId: optionalUuidSchema,
    destinationLocationId: optionalUuidSchema,
    quantity: z
      .string()
      .trim()
      .regex(/^[1-9]\d{0,17}$/, "Quantity must be a positive whole number."),
    unitCost: optionalPositiveMoneySchema,
    unitCostCurrency: z.enum(["RON", "USD"]),
    exchangeRate: optionalExchangeRateSchema,
    businessDayId: z.uuid("Business day is invalid."),
    notes: z
      .string()
      .trim()
      .max(500, "Notes must not exceed 500 characters.")
      .transform((notes) => notes || null),
    idempotencyKey: z.uuid("Stock movement request identifier is invalid."),
    referenceId: z.uuid("Stock movement reference identifier is invalid."),
    allowNegative: z.boolean(),
    overrideReason: optionalOverrideReasonSchema,
  })
  .superRefine((input, context) => {
    const inbound = ["opening", "return", "adjustment_in"].includes(
      input.entryType,
    );
    const outbound = ["damage", "adjustment_out"].includes(input.entryType);
    const sourceMovement = outbound || input.entryType === "transfer";

    if (inbound && !input.destinationLocationId) {
      context.addIssue({
        code: "custom",
        message: "Select a destination location.",
        path: ["destinationLocationId"],
      });
    }

    if (inbound && input.sourceLocationId) {
      context.addIssue({
        code: "custom",
        message: "Inbound movements cannot have a source location.",
        path: ["sourceLocationId"],
      });
    }

    if (outbound && !input.sourceLocationId) {
      context.addIssue({
        code: "custom",
        message: "Select a source location.",
        path: ["sourceLocationId"],
      });
    }

    if (outbound && input.destinationLocationId) {
      context.addIssue({
        code: "custom",
        message: "Outbound movements cannot have a destination location.",
        path: ["destinationLocationId"],
      });
    }

    if (input.entryType === "transfer") {
      if (!input.sourceLocationId) {
        context.addIssue({
          code: "custom",
          message: "Select a source location.",
          path: ["sourceLocationId"],
        });
      }
      if (!input.destinationLocationId) {
        context.addIssue({
          code: "custom",
          message: "Select a destination location.",
          path: ["destinationLocationId"],
        });
      }
      if (
        input.sourceLocationId &&
        input.sourceLocationId === input.destinationLocationId
      ) {
        context.addIssue({
          code: "custom",
          message: "Source and destination must differ.",
          path: ["destinationLocationId"],
        });
      }
    }

    if (input.allowNegative && !input.overrideReason) {
      context.addIssue({
        code: "custom",
        message: "Explain why negative stock is allowed.",
        path: ["overrideReason"],
      });
    }

    if (!sourceMovement && !input.unitCost) {
      context.addIssue({
        code: "custom",
        message: "Enter the purchase price for inbound stock.",
        path: ["unitCost"],
      });
    }

    if (!sourceMovement && !input.exchangeRate) {
      context.addIssue({
        code: "custom",
        message: "Enter the RON rate used for this purchase.",
        path: ["exchangeRate"],
      });
    }
  });

export const stockMovementReversalSchema = z.object({
  movementId: z.uuid("Stock movement is invalid."),
  reason: reversalReasonSchema,
  idempotencyKey: z.uuid("Reversal request identifier is invalid."),
  allowNegative: z.boolean(),
  confirmation: reversalConfirmationSchema(
    "Confirm that this stock movement should be reversed.",
  ),
});

export type StockMovementInput = z.output<typeof stockMovementInputSchema>;
export type StockMovementReversalInput = z.output<
  typeof stockMovementReversalSchema
>;
