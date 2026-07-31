import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("employee membership RPC migration", () => {
  it("requires an admin and records the employee addition atomically", async () => {
    const migration = await readFile(
      join(
        process.cwd(),
        "supabase/migrations/20260630000100_authenticated_employee_invites.sql",
      ),
      "utf8",
    );

    expect(migration).toContain(
      "not private.is_business_admin(target_business_id)",
    );
    expect(migration).toContain("insert into public.business_members");
    expect(migration).toContain("insert into public.audit_logs");
    expect(migration).toContain(
      "grant execute on function public.add_business_employee(uuid, uuid)",
    );
    expect(migration).toContain("to authenticated, service_role");
  });
});
