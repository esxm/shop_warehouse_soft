import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function readProjectFile(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

describe("Supabase credential boundaries", () => {
  it("keeps the service-role variable out of browser-reachable modules", async () => {
    const browserModules = await Promise.all([
      readProjectFile("lib/db/browser.ts"),
      readProjectFile("lib/env/public.ts"),
    ]);

    browserModules.forEach((source) => {
      expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    });
  });

  it("marks every module that reads the service-role key as server-only", async () => {
    const serverEnvironment = await readProjectFile("lib/env/server.ts");
    const adminClient = await readProjectFile("lib/db/admin.ts");

    expect(serverEnvironment).toContain('import "server-only"');
    expect(adminClient).toContain('import "server-only"');
  });
});
