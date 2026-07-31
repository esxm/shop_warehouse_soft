import { describe, expect, it } from "vitest";

import {
  supplierDeactivationSchema,
  supplierInputSchema,
  supplierSearchSchema,
} from "@/lib/validation/suppliers";

const supplierId = "30000000-0000-4000-8000-000000000001";

describe("supplier validation", () => {
  it("normalizes optional fields and default currency", () => {
    expect(
      supplierInputSchema.parse({
        name: "  Supply Company ",
        phone: " +40 712 345 678 ",
        notes: "  Main contact. ",
        defaultCurrency: "USD",
      }),
    ).toEqual({
      name: "Supply Company",
      phone: "+40 712 345 678",
      notes: "Main contact.",
      defaultCurrency: "USD",
    });

    expect(
      supplierInputSchema.parse({
        name: "Supplier",
        phone: "",
        notes: " ",
        defaultCurrency: "",
      }),
    ).toEqual({
      name: "Supplier",
      phone: null,
      notes: null,
      defaultCurrency: null,
    });
  });

  it.each([
    { name: "", phone: "", notes: "", defaultCurrency: "" },
    {
      name: "Supplier",
      phone: "call-me",
      notes: "",
      defaultCurrency: "",
    },
    { name: "Supplier", phone: "++", notes: "", defaultCurrency: "" },
    {
      name: "Supplier",
      phone: "",
      notes: "",
      defaultCurrency: "EUR",
    },
  ])("rejects invalid supplier input", (input) => {
    expect(supplierInputSchema.safeParse(input).success).toBe(false);
  });

  it("limits search and requires deactivation confirmation", () => {
    expect(
      supplierSearchSchema.safeParse({
        query: "x".repeat(101),
        includeInactive: false,
      }).success,
    ).toBe(false);
    expect(
      supplierDeactivationSchema.safeParse({
        supplierId,
        confirmation: undefined,
      }).success,
    ).toBe(false);
    expect(
      supplierDeactivationSchema.safeParse({
        supplierId,
        confirmation: "confirm",
      }).success,
    ).toBe(true);
  });
});
