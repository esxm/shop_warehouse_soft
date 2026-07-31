import { describe, expect, it } from "vitest";

import { auditLogFilterSchema, formatAuditData } from "@/lib/audit/audit-log";

describe("audit-log model", () => {
  it("parses all filters and business-date ranges", () => {
    const filter = auditLogFilterSchema.parse({
      userId: "11111111-1111-4111-8111-111111111111",
      action: "expense.reversed",
      entityType: "expense",
      fromDate: "2026-07-01",
      toDate: "2026-07-31",
    });

    expect(filter).toEqual({
      userId: "11111111-1111-4111-8111-111111111111",
      action: "expense.reversed",
      entityType: "expense",
      fromDate: "2026-07-01",
      toDate: "2026-07-31",
    });
  });

  it("rejects an inverted date range", () => {
    const result = auditLogFilterSchema.safeParse({
      fromDate: "2026-07-31",
      toDate: "2026-07-01",
    });

    expect(result.success).toBe(false);
  });

  it("redacts sensitive fields and sorts keys before display", () => {
    const displayed = formatAuditData({
      visible: "kept",
      password: "hidden",
      nested: {
        access_token: "hidden",
        amount_ron: 100,
      },
    });

    expect(displayed).toContain('"password": "[REDACTED]"');
    expect(displayed).toContain('"access_token": "[REDACTED]"');
    expect(displayed).toContain('"visible": "kept"');
    expect(displayed).not.toContain('"hidden"');
    expect(displayed.indexOf('"nested"')).toBeLessThan(
      displayed.indexOf('"password"'),
    );
  });

  it("handles missing and oversized audit data safely", () => {
    expect(formatAuditData(null)).toBe("No data recorded.");
    expect(formatAuditData({ note: "x".repeat(1200) })).toContain("…");
  });
});
