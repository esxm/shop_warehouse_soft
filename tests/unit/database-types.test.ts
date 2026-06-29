import { describe, expect, it } from "vitest";

import type { Enums, Tables, TablesInsert } from "@/lib/db/database.types";

describe("generated database types", () => {
  it("restricts roles and foundation types to database enum values", () => {
    const role: Enums<"member_role"> = "employee";
    const locationType: Enums<"inventory_location_type"> = "warehouse";
    const accountType: Enums<"financial_account_type"> = "cash";

    expect([role, locationType, accountType]).toEqual([
      "employee",
      "warehouse",
      "cash",
    ]);
  });

  it("types membership rows and business inserts", () => {
    const membership: Tables<"business_members"> = {
      business_id: "business-id",
      created_at: "2026-06-29T00:00:00.000Z",
      is_active: true,
      role: "admin",
      user_id: "user-id",
    };
    const business: TablesInsert<"businesses"> = {
      created_by: "user-id",
      name: "Test Business",
      timezone: "Europe/Bucharest",
    };

    expect(membership.role).toBe("admin");
    expect(business.name).toBe("Test Business");
  });
});
