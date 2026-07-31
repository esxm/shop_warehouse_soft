import { describe, expect, it, vi } from "vitest";

import {
  resolveHistoryDate,
  resolveHistoryPeriod,
} from "@/lib/date/history-date";

describe("history date selection", () => {
  it("uses a valid requested business date", () => {
    expect(
      resolveHistoryDate({ history_date: "2026-07-02" }, "Europe/Bucharest"),
    ).toEqual({ date: "2026-07-02", error: null });
  });

  it("defaults invalid input to the current business date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-04T12:00:00Z"));

    expect(
      resolveHistoryDate({ history_date: "2026-02-31" }, "Europe/Bucharest"),
    ).toMatchObject({ date: "2026-07-04" });

    vi.useRealTimers();
  });
});

describe("history period selection", () => {
  it("uses a valid inclusive date range", () => {
    expect(
      resolveHistoryPeriod(
        { history_from: "2026-06-01", history_to: "2026-06-30" },
        "Europe/Bucharest",
      ),
    ).toEqual({
      fromDate: "2026-06-01",
      toDate: "2026-06-30",
      error: null,
    });
  });

  it("rejects a range whose end is before its start", () => {
    expect(
      resolveHistoryPeriod(
        { history_from: "2026-06-30", history_to: "2026-06-01" },
        "Europe/Bucharest",
      ).error,
    ).toBeTruthy();
  });
});
