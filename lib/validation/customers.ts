import { z } from "zod";

const customerNameSchema = z
  .string()
  .trim()
  .min(1, "Customer name is required.")
  .max(120, "Customer name must not exceed 120 characters.");

const customerPhoneSchema = z
  .string()
  .trim()
  .max(40, "Phone must not exceed 40 characters.")
  .refine(
    (phone) =>
      phone === "" || (/^[0-9+(). /-]+$/.test(phone) && /\d/.test(phone)),
    "Phone contains unsupported characters.",
  )
  .transform((phone) => phone || null);

const customerNotesSchema = z
  .string()
  .trim()
  .max(1000, "Notes must not exceed 1000 characters.")
  .transform((notes) => notes || null);

export const customerIdSchema = z.uuid("Customer is invalid.");

export const customerInputSchema = z.object({
  name: customerNameSchema,
  phone: customerPhoneSchema,
  notes: customerNotesSchema,
});

export const customerUpdateSchema = customerInputSchema.extend({
  customerId: customerIdSchema,
});

export const customerDeactivationSchema = z.object({
  customerId: customerIdSchema,
  confirmation: z.literal("confirm", {
    error: "Confirm that this customer should be deactivated.",
  }),
});

export const customerSearchSchema = z.object({
  query: z.string().trim().max(100, "Search must not exceed 100 characters."),
  includeInactive: z.boolean(),
});

export type CustomerInput = z.output<typeof customerInputSchema>;
export type CustomerUpdateInput = z.output<typeof customerUpdateSchema>;
export type CustomerSearchInput = z.output<typeof customerSearchSchema>;
