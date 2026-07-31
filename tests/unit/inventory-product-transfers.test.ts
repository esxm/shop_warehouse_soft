import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function readProjectFile(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

describe("product inventory transfers", () => {
  it("uses the atomic product transfer RPC and line summaries", async () => {
    const service = await readProjectFile("services/inventory-value.ts");

    expect(service).toContain('"create_inventory_product_transfer"');
    expect(service).toContain('from("inventory_transfer_line_summaries")');
    expect(service).toContain("target_lines:");
    expect(service).toContain("target_allow_negative_stock:");
  });

  it("offers multiple product lines with warehouse availability", async () => {
    const form = await readProjectFile(
      "components/inventory-transfer-form.tsx",
    );

    expect(form).toContain("Products to transfer");
    expect(form).toContain("warehouseQuantity");
    expect(form).toContain("Add product line");
    expect(form).not.toContain('name="amountRon"');
  });

  it("removes transfer entry and history from product inventory", async () => {
    const page = await readProjectFile(
      "app/(protected)/inventory-value/page.tsx",
    );

    expect(page).not.toContain("<InventoryTransferForm");
    expect(page).not.toContain("<InventoryTransferReversalForm");
    expect(page).not.toContain("Product transfer history");
    expect(page).not.toContain("products={transferProducts}");
    expect(page).toContain("Products &amp; Stock movement history");
  });

  it("shows only the product-valued inventory interface", async () => {
    const page = await readProjectFile(
      "app/(protected)/inventory-value/page.tsx",
    );

    expect(page).toContain("Product-valued inventory");
    expect(page).toContain("USD price / piece");
    expect(page).toContain("Weighted RON:");
    expect(page).not.toContain("<InventoryStocktakeForm");
    expect(page).not.toContain("Current amount-only inventory");
  });

  it("refreshes stock after creation and reversal", async () => {
    const actions = await readProjectFile(
      "app/(protected)/inventory-value/actions.ts",
    );

    expect(actions.split('revalidatePath("/stock")')).toHaveLength(3);
  });
});
