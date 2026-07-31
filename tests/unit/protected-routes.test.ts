import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function readProjectFile(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

describe("server route protection", () => {
  it("guards the application route group with a membership check", async () => {
    const layout = await readProjectFile("app/(protected)/layout.tsx");

    expect(layout).toContain("requireBusinessMember");
    expect(layout).toContain("await requireBusinessMember()");
  });

  it("guards administrator routes and mutations on the server", async () => {
    const [layout, userAction, openingAction, customerAction, supplierAction] =
      await Promise.all([
        readProjectFile("app/(protected)/(admin)/layout.tsx"),
        readProjectFile("app/(protected)/(admin)/users/actions.ts"),
        readProjectFile("app/(protected)/(admin)/opening-balances/actions.ts"),
        readProjectFile("app/(protected)/customers/actions.ts"),
        readProjectFile("app/(protected)/suppliers/actions.ts"),
      ]);

    expect(layout).toContain("await requireAdmin()");
    expect(userAction).toContain("const context = await requireAdmin()");
    expect(openingAction).toContain("const context = await requireAdmin()");
    expect(customerAction).toContain("const context = await requireAdmin()");
    expect(customerAction).toContain(
      "const context = await requireBusinessMember()",
    );
    expect(supplierAction).toContain("const context = await requireAdmin()");
    expect(supplierAction).toContain(
      "const context = await requireBusinessMember()",
    );
  });
});
