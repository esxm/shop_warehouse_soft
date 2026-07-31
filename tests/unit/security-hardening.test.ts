import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { csvRow, protectSpreadsheetCell } from "@/lib/reports/csv";
import {
  employeeAccessSchema,
  passwordResetRequestSchema,
} from "@/lib/validation/auth";

async function readProjectFile(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

async function listSourceFiles(path: string): Promise<string[]> {
  const directory = join(process.cwd(), path);
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = join(path, entry.name);

      if (entry.isDirectory()) {
        return listSourceFiles(relativePath);
      }

      return /\.(?:ts|tsx)$/.test(entry.name) ? [relativePath] : [];
    }),
  );

  return nestedFiles.flat();
}

describe("security hardening", () => {
  it("neutralizes spreadsheet formulas without changing numeric losses", () => {
    expect(protectSpreadsheetCell('=HYPERLINK("bad")')).toBe(
      '\'=HYPERLINK("bad")',
    );
    expect(protectSpreadsheetCell("+SUM(1,2)")).toBe("'+SUM(1,2)");
    expect(protectSpreadsheetCell("-cmd|' /C calc'!A0")).toBe(
      "'-cmd|' /C calc'!A0",
    );
    expect(protectSpreadsheetCell("-90.00")).toBe("-90.00");
    expect(csvRow(["=1+1", 'A "quote"'])).toBe('"\'=1+1","A ""quote"""');
  });

  it("validates password-reset email without account-specific output", () => {
    expect(
      passwordResetRequestSchema.parse({
        email: "  USER@EXAMPLE.COM ",
      }),
    ).toEqual({ email: "user@example.com" });
    expect(
      passwordResetRequestSchema.safeParse({ email: "not-an-email" }).success,
    ).toBe(false);
  });

  it("requires confirmation when deactivating an employee", () => {
    const userId = "26000000-0000-4000-8000-000000000003";

    expect(
      employeeAccessSchema.safeParse({
        userId,
        active: "false",
        confirmation: undefined,
      }).success,
    ).toBe(false);
    expect(
      employeeAccessSchema.parse({
        userId,
        active: "false",
        confirmation: "confirm",
      }),
    ).toMatchObject({ userId, active: false });
    expect(
      employeeAccessSchema.safeParse({
        userId,
        active: "true",
      }).success,
    ).toBe(true);
  });

  it("configures browser security headers and disables framework disclosure", async () => {
    const config = await readProjectFile("next.config.ts");

    for (const header of [
      "Content-Security-Policy",
      "Strict-Transport-Security",
      "Permissions-Policy",
      "Referrer-Policy",
      "X-Content-Type-Options",
      "X-Frame-Options",
    ]) {
      expect(config).toContain(header);
    }
    expect(config).toContain("poweredByHeader: false");
    expect(config).toContain("frame-ancestors 'none'");
    expect(config).toContain("form-action 'self'");
  });

  it("keeps privileged clients and authentication throttles server-only", async () => {
    const [adminClient, serverEnvironment, rateLimitService] =
      await Promise.all([
        readProjectFile("lib/db/admin.ts"),
        readProjectFile("lib/env/server.ts"),
        readProjectFile("services/auth-rate-limit.ts"),
      ]);

    expect(adminClient).toMatch(/^import "server-only";/);
    expect(serverEnvironment).toMatch(/^import "server-only";/);
    expect(rateLimitService).toMatch(/^import "server-only";/);
    expect(adminClient).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("does not import privileged modules into client components", async () => {
    const sourceFiles = [
      ...(await listSourceFiles("app")),
      ...(await listSourceFiles("components")),
    ];

    for (const path of sourceFiles) {
      const source = await readProjectFile(path);

      if (!/^["']use client["'];/.test(source)) {
        continue;
      }

      expect(source, path).not.toContain("@/lib/db/admin");
      expect(source, path).not.toContain("@/lib/db/server");
      expect(source, path).not.toContain("@/lib/env/server");
      expect(source, path).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    }
  });

  it("re-authorizes admin actions and prevents password-reset open redirects", async () => {
    const [userActions, callback] = await Promise.all([
      readProjectFile("app/(protected)/(admin)/users/actions.ts"),
      readProjectFile("app/auth/callback/route.ts"),
    ]);

    expect(userActions).toContain("const context = await requireAdmin()");
    expect(callback).toContain(
      'const allowedNextPaths = new Set(["/set-password"])',
    );
    expect(callback).not.toContain("NextResponse.redirect(requestedNext)");
  });
});
