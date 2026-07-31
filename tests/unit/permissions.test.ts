import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  assertOpenBusinessDayAccess,
  OpenBusinessDayRequiredError,
} from "@/lib/auth/permission-rules";
import type { CurrentUserContext } from "@/lib/auth/types";

const context: CurrentUserContext = {
  user: {
    id: "10000000-0000-0000-0000-000000000001",
    email: "admin@example.test",
    displayName: "Admin",
  },
  profile: { fullName: "Admin" },
  business: {
    id: "20000000-0000-0000-0000-000000000001",
    name: "Test Business",
    timezone: "Europe/Bucharest",
  },
  role: "admin",
};

describe("permission helpers", () => {
  it("accepts only an open day belonging to the current business", () => {
    const day = {
      id: "30000000-0000-0000-0000-000000000001",
      businessId: context.business.id,
      status: "open",
    };

    expect(assertOpenBusinessDayAccess(context, day)).toBe(day);
  });

  it.each([
    null,
    {
      id: "30000000-0000-0000-0000-000000000001",
      businessId: "20000000-0000-0000-0000-000000000002",
      status: "open",
    },
    {
      id: "30000000-0000-0000-0000-000000000001",
      businessId: "20000000-0000-0000-0000-000000000001",
      status: "closed",
    },
  ])("rejects missing, cross-business, or closed days", (day) => {
    expect(() => assertOpenBusinessDayAccess(context, day)).toThrow(
      OpenBusinessDayRequiredError,
    );
  });

  it("exposes every required guard through the server-only session module", async () => {
    const source = await readFile(
      join(process.cwd(), "lib/auth/session.ts"),
      "utf8",
    );

    expect(source).toContain('import "server-only"');
    expect(source).toContain("requireAuthenticatedUser");
    expect(source).toContain("requireBusinessMember");
    expect(source).toContain("requireAdmin");
    expect(source).toContain("requireOpenBusinessDay");
    expect(source).toContain("assertOpenBusinessDayAccess");
  });
});
