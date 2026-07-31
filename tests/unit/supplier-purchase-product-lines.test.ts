import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function readProjectFile(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

describe("supplier purchase product lines", () => {
  it("uses the atomic product-line receipt RPC", async () => {
    const service = await readProjectFile("services/supplier-purchases.ts");

    expect(service).toContain(
      '"create_supplier_purchase_with_lines_idempotent"',
    );
    expect(service).toContain('from("supplier_purchase_line_summaries")');
    expect(service).toContain("target_lines:");
    expect(service).toContain("target_allow_negative_stock:");
  });

  it("shows itemized product history and labels legacy purchases", async () => {
    const page = await readProjectFile(
      "app/(protected)/suppliers/[supplierId]/page.tsx",
    );

    expect(page).toContain("purchase.lines.map");
    expect(page).toContain("line.productCode");
    expect(page).toContain("Historical value-only purchase");
    expect(page).toContain("products={products}");
  });

  it("refreshes product stock after purchase creation and reversal", async () => {
    const actions = await readProjectFile(
      "app/(protected)/suppliers/actions.ts",
    );

    expect(actions.split('revalidatePath("/stock")')).toHaveLength(3);
  });
});
