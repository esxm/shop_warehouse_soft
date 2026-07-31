import { describe, expect, it } from "vitest";

import {
  compareBusinessDates,
  formatInstantInBusinessTimeZone,
  getBusinessDate,
  getTodayInBusinessTimeZone,
  isSameBusinessDate,
  parseBusinessDate,
  requireValidTimeZone,
} from "@/lib/date/business-date";

describe("business timezone date utilities", () => {
  it("derives the date in the configured business timezone", () => {
    const instant = "2026-01-01T22:30:00Z";

    expect(getBusinessDate(instant, "UTC")).toBe("2026-01-01");
    expect(getBusinessDate(instant, "Europe/Bucharest")).toBe("2026-01-02");
  });

  it("uses the supplied clock for a timezone-safe current business date", () => {
    const clock = () => new Date("2026-06-30T21:30:00Z");

    expect(getTodayInBusinessTimeZone("Europe/Bucharest", clock)).toBe(
      "2026-07-01",
    );
  });

  it("handles explicit timestamp offsets consistently", () => {
    expect(
      getBusinessDate("2026-07-01T00:30:00+03:00", "Europe/Bucharest"),
    ).toBe("2026-07-01");
  });

  it("rejects timezone-ambiguous and invalid timestamps", () => {
    expect(() =>
      getBusinessDate("2026-01-01T12:00:00", "Europe/Bucharest"),
    ).toThrow("explicit offset");
    expect(() => getBusinessDate("not-a-dateZ", "Europe/Bucharest")).toThrow(
      "Invalid timestamp",
    );
  });

  it("rejects unknown IANA timezones", () => {
    expect(requireValidTimeZone("Europe/Bucharest")).toBe("Europe/Bucharest");
    expect(() => requireValidTimeZone("Europe/Not-A-City")).toThrow(
      "Unknown business timezone",
    );
  });

  it("validates real ISO calendar dates", () => {
    expect(parseBusinessDate("2028-02-29")).toBe("2028-02-29");
    expect(() => parseBusinessDate("2027-02-29")).toThrow(
      "not a real calendar date",
    );
    expect(() => parseBusinessDate("30-06-2026")).toThrow("YYYY-MM-DD");
  });

  it("compares and matches dates without local-machine timezone effects", () => {
    const first = parseBusinessDate("2026-06-30");
    const second = parseBusinessDate("2026-07-01");

    expect(compareBusinessDates(first, second)).toBe(-1);
    expect(compareBusinessDates(second, first)).toBe(1);
    expect(compareBusinessDates(first, first)).toBe(0);
    expect(
      isSameBusinessDate(
        "2026-06-30T21:30:00Z",
        "2026-07-01T10:00:00Z",
        "Europe/Bucharest",
      ),
    ).toBe(true);
  });

  it("formats an instant in the requested timezone", () => {
    expect(
      formatInstantInBusinessTimeZone(
        "2026-01-01T22:30:45Z",
        "Europe/Bucharest",
        "en-GB",
      ),
    ).toBe("02/01/2026, 00:30:45");
  });
});
