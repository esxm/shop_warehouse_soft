import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

async function readProjectFile(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

describe("product master routes", () => {
  it("renders search, category management, product creation, and CSV import", async () => {
    const [stockPage, management] = await Promise.all([
      readProjectFile("app/(protected)/stock/page.tsx"),
      readProjectFile("components/product-management.tsx"),
    ]);

    expect(stockPage).toContain("productSearchSchema.safeParse");
    expect(stockPage).toContain("<ProductManagement");
    expect(management).toContain("<ProductForm");
    expect(management).toContain("<ProductCategoryForm");
    expect(management).toContain("<ProductCsvImport");
    expect(management).toContain("Include inactive products");
  });

  it("validates product route IDs and limits deactivation to administrators", async () => {
    const page = await readProjectFile(
      "app/(protected)/products/[productId]/page.tsx",
    );

    expect(page).toContain("productIdSchema.safeParse");
    expect(page).toContain("notFound()");
    expect(page).toContain('context.role === "admin"');
    expect(page).toContain("<ProductDeactivationForm");
  });

  it("redirects the old product list and exposes one combined navigation item", async () => {
    const [page, navigation] = await Promise.all([
      readProjectFile("app/(protected)/products/page.tsx"),
      readProjectFile("lib/auth/navigation.ts"),
    ]);

    expect(page).toContain('redirect("/stock#products")');
    expect(navigation).toContain(
      '{ label: "Products & Stock", href: "/stock" }',
    );
    expect(navigation).not.toContain('href: "/products"');
  });
});
