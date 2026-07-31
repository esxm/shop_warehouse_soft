import { z } from "zod";

import {
  MoneyInputError,
  parseExchangeRate,
  parseMoneyInput,
  requireNonNegativeMoney,
  type MoneyAmount,
} from "@/lib/money/money";

const internalCodePattern = /^[A-Z0-9][A-Z0-9._-]*$/;

const nullableInternalCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .max(40, "Internal code must not exceed 40 characters.")
  .refine(
    (code) => code === "" || internalCodePattern.test(code),
    "Use only letters, numbers, dots, underscores, and hyphens.",
  )
  .transform((code) => code || null);

const productNameSchema = z
  .string()
  .trim()
  .min(1, "Product name is required.")
  .max(160, "Product name must not exceed 160 characters.");

const categoryNameSchema = z
  .string()
  .trim()
  .min(1, "Category name is required.")
  .max(120, "Category name must not exceed 120 characters.");

const nullableProductMoneySchema = z
  .string()
  .trim()
  .transform((input, context): MoneyAmount | null => {
    if (!input) {
      return null;
    }

    try {
      return requireNonNegativeMoney(parseMoneyInput(input));
    } catch (error) {
      context.addIssue({
        code: "custom",
        message:
          error instanceof MoneyInputError
            ? error.message
            : "Enter a valid non-negative amount.",
      });
      return z.NEVER;
    }
  });

const nullableExchangeRateSchema = z
  .string()
  .trim()
  .transform((input, context) => {
    if (!input) {
      return null;
    }

    try {
      return parseExchangeRate(input);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message:
          error instanceof MoneyInputError
            ? error.message
            : "Enter a valid exchange rate.",
      });
      return z.NEVER;
    }
  });

export const productIdSchema = z.uuid("Product is invalid.");
export const productCategoryIdSchema = z.uuid("Product category is invalid.");

export const productCategoryInputSchema = z.object({
  name: categoryNameSchema,
});

export const productCategoryUpdateSchema = productCategoryInputSchema.extend({
  categoryId: productCategoryIdSchema,
});

export const productCategoryDeactivationSchema = z.object({
  categoryId: productCategoryIdSchema,
  confirmation: z.literal("confirm", {
    error: "Confirm that this category should be deactivated.",
  }),
});

export const productInputSchema = z
  .object({
    internalCode: nullableInternalCodeSchema,
    name: productNameSchema,
    categoryId: productCategoryIdSchema,
    defaultPurchaseCostRon: nullableProductMoneySchema,
    defaultPurchaseCurrency: z.enum(["RON", "USD"]),
    defaultPurchaseExchangeRate: nullableExchangeRateSchema,
    defaultSellingPriceRon: nullableProductMoneySchema,
  })
  .superRefine((input, context) => {
    if (
      input.defaultPurchaseCostRon &&
      input.defaultPurchaseCurrency === "USD" &&
      !input.defaultPurchaseExchangeRate
    ) {
      context.addIssue({
        code: "custom",
        message: "Enter the RON rate used for this USD purchase price.",
        path: ["defaultPurchaseExchangeRate"],
      });
    }

    if (
      input.defaultPurchaseCurrency === "RON" &&
      input.defaultPurchaseExchangeRate
    ) {
      context.addIssue({
        code: "custom",
        message: "RON purchase prices do not use an exchange rate.",
        path: ["defaultPurchaseExchangeRate"],
      });
    }
  });

export const productUpdateSchema = productInputSchema
  .extend({
    productId: productIdSchema,
  })
  .superRefine((input, context) => {
    if (input.internalCode === null) {
      context.addIssue({
        code: "custom",
        message: "Internal code is required when editing a product.",
        path: ["internalCode"],
      });
    }
  });

export const productDeactivationSchema = z.object({
  productId: productIdSchema,
  confirmation: z.literal("confirm", {
    error: "Confirm that this product should be deactivated.",
  }),
});

export const productSearchSchema = z.object({
  query: z.string().trim().max(100, "Search must not exceed 100 characters."),
  categoryId: z
    .string()
    .trim()
    .transform((value) => value || null)
    .pipe(z.uuid("Product category filter is invalid.").nullable()),
  includeInactive: z.boolean(),
});

export const productCsvRowSchema = z.object({
  internalCode: nullableInternalCodeSchema,
  name: productNameSchema,
  category: categoryNameSchema,
  defaultPurchaseCostRon: nullableProductMoneySchema,
  defaultSellingPriceRon: nullableProductMoneySchema,
});

export const resolvedProductImportRowSchema = z.object({
  internal_code: z.string().max(40),
  name: productNameSchema,
  category_id: productCategoryIdSchema,
  default_purchase_cost_ron: z.string(),
  default_selling_price_ron: z.string(),
});

export const productImportSchema = z.object({
  idempotencyKey: z.uuid("Product import request identifier is invalid."),
  rows: z
    .array(resolvedProductImportRowSchema)
    .min(1, "Import at least one product.")
    .max(500, "Import at most 500 products at a time."),
});

export type ProductInput = z.output<typeof productInputSchema>;
export type ProductUpdateInput = z.output<typeof productUpdateSchema>;
export type ProductSearchInput = z.output<typeof productSearchSchema>;
export type ProductCategoryInput = z.output<typeof productCategoryInputSchema>;
export type ProductCategoryUpdateInput = z.output<
  typeof productCategoryUpdateSchema
>;
export type ResolvedProductImportRow = z.output<
  typeof resolvedProductImportRowSchema
>;
