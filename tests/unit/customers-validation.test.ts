import { describe, expect, it } from "vitest";

import {
  customerDeactivationSchema,
  customerInputSchema,
  customerSearchSchema,
} from "@/lib/validation/customers";

const customerId = "30000000-0000-4000-8000-000000000001";

describe("customer validation", () => {
  it("normalizes optional fields and preserves a valid customer", () => {
    expect(
      customerInputSchema.parse({
        name: "  Ahmed Popescu ",
        phone: " +40 712 345 678 ",
        notes: "  Calls in the afternoon. ",
      }),
    ).toEqual({
      name: "Ahmed Popescu",
      phone: "+40 712 345 678",
      notes: "Calls in the afternoon.",
    });

    expect(
      customerInputSchema.parse({
        name: "Customer",
        phone: "",
        notes: " ",
      }),
    ).toEqual({
      name: "Customer",
      phone: null,
      notes: null,
    });
  });

  it.each([
    { name: "", phone: "", notes: "" },
    { name: "Customer", phone: "call-me", notes: "" },
    { name: "Customer", phone: "++", notes: "" },
    { name: "x".repeat(121), phone: "", notes: "" },
    { name: "Customer", phone: "", notes: "x".repeat(1001) },
  ])("rejects invalid customer input", (input) => {
    expect(customerInputSchema.safeParse(input).success).toBe(false);
  });

  it("limits search input and requires deactivation confirmation", () => {
    expect(
      customerSearchSchema.safeParse({
        query: "x".repeat(101),
        includeInactive: false,
      }).success,
    ).toBe(false);
    expect(
      customerDeactivationSchema.safeParse({
        customerId,
        confirmation: undefined,
      }).success,
    ).toBe(false);
    expect(
      customerDeactivationSchema.safeParse({
        customerId,
        confirmation: "confirm",
      }).success,
    ).toBe(true);
  });
});
