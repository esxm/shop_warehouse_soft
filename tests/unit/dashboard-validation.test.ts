import { describe, expect, it } from "vitest";

import { usdRonReferenceRateSchema } from "@/lib/validation/dashboard";

describe("dashboard reference-rate validation", () => {
  it("normalizes a valid rate and date", () => {
    expect(
      usdRonReferenceRateSchema.parse({
        rate: " 4,52345678 ",
        effectiveDate: "2026-07-01",
      }),
    ).toEqual({
      rate: "4.52345678",
      effectiveDate: "2026-07-01",
    });
  });

  it.each(["", "0", "-1", "1.123456789", "abc"])(
    "rejects invalid rate %s",
    (rate) => {
      expect(
        usdRonReferenceRateSchema.safeParse({
          rate,
          effectiveDate: "2026-07-01",
        }).success,
      ).toBe(false);
    },
  );

  it("rejects an invalid calendar date", () => {
    expect(
      usdRonReferenceRateSchema.safeParse({
        rate: "4.5",
        effectiveDate: "2026-02-30",
      }).success,
    ).toBe(false);
  });
});
