import { z } from "zod";

const supplierNameSchema = z
  .string()
  .trim()
  .min(1, "Supplier name is required.")
  .max(120, "Supplier name must not exceed 120 characters.");

const supplierPhoneSchema = z
  .string()
  .trim()
  .max(40, "Phone must not exceed 40 characters.")
  .refine(
    (phone) =>
      phone === "" || (/^[0-9+(). /-]+$/.test(phone) && /\d/.test(phone)),
    "Phone contains unsupported characters.",
  )
  .transform((phone) => phone || null);

const supplierNotesSchema = z
  .string()
  .trim()
  .max(1000, "Notes must not exceed 1000 characters.")
  .transform((notes) => notes || null);

const defaultCurrencySchema = z
  .union([z.literal(""), z.enum(["RON", "USD"])])
  .transform((currency) => currency || null);

export const supplierIdSchema = z.uuid("Supplier is invalid.");

export const supplierInputSchema = z.object({
  name: supplierNameSchema,
  phone: supplierPhoneSchema,
  notes: supplierNotesSchema,
  defaultCurrency: defaultCurrencySchema,
});

export const supplierUpdateSchema = supplierInputSchema.extend({
  supplierId: supplierIdSchema,
});

export const supplierDeactivationSchema = z.object({
  supplierId: supplierIdSchema,
  confirmation: z.literal("confirm", {
    error: "Confirm that this supplier should be deactivated.",
  }),
});

export const supplierSearchSchema = z.object({
  query: z.string().trim().max(100, "Search must not exceed 100 characters."),
  includeInactive: z.boolean(),
});

export type SupplierInput = z.output<typeof supplierInputSchema>;
export type SupplierUpdateInput = z.output<typeof supplierUpdateSchema>;
export type SupplierSearchInput = z.output<typeof supplierSearchSchema>;
