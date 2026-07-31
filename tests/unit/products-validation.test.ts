import { describe, expect, it } from "vitest";

import {
  productInputSchema,
  productSearchSchema,
  productUpdateSchema,
} from "@/lib/validation/products";

const categoryId = "31000000-0000-4000-8000-000000000011";
const productId = "31000000-0000-4000-8000-000000000012";

describe("product validation", () => {
  it("normalizes a manual code and optional default prices", () => {
    expect(
      productInputSchema.parse({
        internalCode: " bath-001 ",
        name: " Bathroom set ",
        categoryId,
        defaultPurchaseCostRon: "100,5",
        defaultPurchaseCurrency: "USD",
        defaultPurchaseExchangeRate: "4.61",
        defaultSellingPriceRon: "",
      }),
    ).toEqual({
      internalCode: "BATH-001",
      name: "Bathroom set",
      categoryId,
      defaultPurchaseCostRon: "100.50",
      defaultPurchaseCurrency: "USD",
      defaultPurchaseExchangeRate: "4.61",
      defaultSellingPriceRon: null,
    });
  });

  it("allows a generated code only when creating", () => {
    expect(
      productInputSchema.parse({
        internalCode: "",
        name: "Bath mat",
        categoryId,
        defaultPurchaseCostRon: "",
        defaultPurchaseCurrency: "RON",
        defaultPurchaseExchangeRate: "",
        defaultSellingPriceRon: "",
      }).internalCode,
    ).toBeNull();

    expect(
      productUpdateSchema.safeParse({
        productId,
        internalCode: "",
        name: "Bath mat",
        categoryId,
        defaultPurchaseCostRon: "",
        defaultPurchaseCurrency: "RON",
        defaultPurchaseExchangeRate: "",
        defaultSellingPriceRon: "",
      }).success,
    ).toBe(false);
  });

  it.each(["bad code", "@CODE", "CODE/1", "é"] as const)(
    "rejects invalid internal code %s",
    (internalCode) => {
      expect(
        productInputSchema.safeParse({
          internalCode,
          name: "Product",
          categoryId,
          defaultPurchaseCostRon: "",
          defaultPurchaseCurrency: "RON",
          defaultPurchaseExchangeRate: "",
          defaultSellingPriceRon: "",
        }).success,
      ).toBe(false);
    },
  );

  it("rejects negative, grouped, and over-precision prices", () => {
    for (const price of ["-1", "1,000.00", "1.234"]) {
      expect(
        productInputSchema.safeParse({
          internalCode: "",
          name: "Product",
          categoryId,
          defaultPurchaseCostRon: price,
          defaultPurchaseCurrency: "RON",
          defaultPurchaseExchangeRate: "",
          defaultSellingPriceRon: "",
        }).success,
      ).toBe(false);
    }
  });

  it("rejects unsupported purchase currencies", () => {
    expect(
      productInputSchema.safeParse({
        internalCode: "",
        name: "Product",
        categoryId,
        defaultPurchaseCostRon: "5",
        defaultPurchaseCurrency: "EUR",
        defaultPurchaseExchangeRate: "",
        defaultSellingPriceRon: "",
      }).success,
    ).toBe(false);
  });

  it("requires an exchange rate for a USD purchase cost", () => {
    expect(
      productInputSchema.safeParse({
        internalCode: "",
        name: "Product",
        categoryId,
        defaultPurchaseCostRon: "5",
        defaultPurchaseCurrency: "USD",
        defaultPurchaseExchangeRate: "",
        defaultSellingPriceRon: "",
      }).success,
    ).toBe(false);
  });

  it("normalizes product search filters", () => {
    expect(
      productSearchSchema.parse({
        query: "  mat ",
        categoryId: "",
        includeInactive: false,
      }),
    ).toEqual({
      query: "mat",
      categoryId: null,
      includeInactive: false,
    });
  });
});
