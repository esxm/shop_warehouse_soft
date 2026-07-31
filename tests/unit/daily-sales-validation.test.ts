import { describe, expect, it } from "vitest";

import { dailySalesDraftSchema } from "@/lib/validation/daily-sales";

const businessDayId = "40000000-0000-4000-8000-000000000001";

describe("daily sales validation", () => {
  it("normalizes nonnegative amounts and optional notes", () => {
    expect(
      dailySalesDraftSchema.parse({
        businessDayId,
        cashSalesRon: "100,50",
        bankSalesRon: "0",
        creditSalesRon: "25.00",
        notes: " Reviewed totals ",
      }),
    ).toEqual({
      businessDayId,
      cashSalesRon: "100.50",
      bankSalesRon: "0.00",
      creditSalesRon: "25.00",
      notes: "Reviewed totals",
    });
  });

  it.each(["-1", "1.234", "1,000.00", "abc"])(
    "rejects invalid daily amounts",
    (cashSalesRon) => {
      expect(
        dailySalesDraftSchema.safeParse({
          businessDayId,
          cashSalesRon,
          bankSalesRon: "0",
          creditSalesRon: "0",
          notes: "",
        }).success,
      ).toBe(false);
    },
  );

  it("allows a zero-sales day", () => {
    expect(
      dailySalesDraftSchema.safeParse({
        businessDayId,
        cashSalesRon: "0",
        bankSalesRon: "0",
        creditSalesRon: "0",
        notes: "",
      }).success,
    ).toBe(true);
  });
});
