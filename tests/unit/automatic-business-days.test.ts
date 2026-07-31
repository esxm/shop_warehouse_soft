import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function readProjectFile(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

describe("automatic business-day lifecycle", () => {
  it("uses a timezone-aware cron rollover with an on-demand fallback", async () => {
    const migration = await readProjectFile(
      "supabase/migrations/20260702000300_automatic_business_days.sql",
    );
    const service = await readProjectFile("services/business-days.ts");

    expect(migration).toContain("create extension if not exists pg_cron");
    expect(migration).toContain("'* * * * *'");
    expect(migration).toContain("at time zone business_timezone");
    expect(migration).toContain("private.process_automatic_business_days()");
    expect(migration).toContain("public.ensure_current_business_day");
    expect(service).toContain('"ensure_current_business_day"');
  });

  it("closes from the last saved draft, refreshes credit, and records its editor", async () => {
    const migration = await readProjectFile(
      "supabase/migrations/20260702000300_automatic_business_days.sql",
    );

    expect(migration).toContain("last_draft_by");
    expect(migration).toContain("last_draft_at");
    expect(migration).toContain("private.capture_daily_sales_last_editor");
    expect(migration).toContain("sale_to_close.cash_sales_ron");
    expect(migration).toContain("sale_to_close.bank_sales_ron");
    expect(migration).toContain(
      "sale_to_close.credit_sales_ron := derived_credit",
    );
    expect(migration).toContain("daily_sales.automatically_closed");
    expect(migration).toContain("business_day.automatically_opened");
  });

  it("serializes rollover and prevents manual lifecycle execution", async () => {
    const migration = await readProjectFile(
      "supabase/migrations/20260702000300_automatic_business_days.sql",
    );

    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain(
      "revoke execute on function public.create_business_day",
    );
    expect(migration).toContain(
      "revoke execute on function public.close_business_day",
    );
    expect(migration).toContain(
      "revoke execute on function public.reopen_business_day",
    );
    expect(migration).toContain(
      "revoke execute on function public.close_daily_sales",
    );
  });

  it("recovers a current day that was manually closed before automation", async () => {
    const recovery = await readProjectFile(
      "supabase/migrations/20260702000400_automatic_current_day_recovery.sql",
    );

    expect(recovery).toContain("private.reopen_current_day_for_automation");
    expect(recovery).toContain("daily_sales.automatically_reopened");
    expect(recovery).toContain("business_day.automatically_reopened");
    expect(recovery).toContain("reversal_of_id");
    expect(recovery).toContain("last_draft_by");
    expect(recovery).toContain("private.process_automatic_business_days()");
  });

  it("uses unambiguous identifiers in the automatic day opener", async () => {
    const fix = await readProjectFile(
      "supabase/migrations/20260702000500_automatic_day_variable_fix.sql",
    );

    expect(fix).toContain("selected_day_id");
    expect(fix).toContain("selected_sales_id");
    expect(fix).not.toContain("sale.business_day_id = business_day_id");
    expect(fix).toContain("private.process_automatic_business_days()");
  });

  it("removes manual controls and explains automatic daily-sales close", async () => {
    const [navigation, redirectPage, manager, actions] = await Promise.all([
      readProjectFile("lib/auth/navigation.ts"),
      readProjectFile("app/(protected)/business-days/page.tsx"),
      readProjectFile("components/daily-sales-manager.tsx"),
      readProjectFile("app/(protected)/daily-sales/actions.ts"),
    ]);

    expect(navigation).not.toContain('label: "Business Days"');
    expect(redirectPage).toContain('redirect("/daily-sales")');
    expect(manager).toContain("Automatic midnight close");
    expect(manager).toContain("Last draft saved by");
    expect(manager).not.toContain("Close day");
    expect(actions).not.toContain("closeDailySalesAction");
  });

  it("exposes last-draft attribution in daily-sales history", async () => {
    const [service, page] = await Promise.all([
      readProjectFile("services/daily-sales.ts"),
      readProjectFile("app/(protected)/daily-sales/page.tsx"),
    ]);

    expect(service).toContain("last_draft_by_name");
    expect(service).toContain("lastDraftByName");
    expect(page).toContain("Last recorded by");
    expect(page).toContain("No individual sale was recorded for this day");
  });
});
