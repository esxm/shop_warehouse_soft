import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

const criticalRoutes = [
  { path: "/", text: "Net business value" },
  { path: "/daily-sales", text: "Record a sale" },
  { path: "/stock", text: "Stock by location" },
  { path: "/customers", text: "Customers" },
  { path: "/suppliers", text: "Suppliers" },
  { path: "/cash-and-bank", text: "Cash and Bank" },
  { path: "/reports", text: "Daily revenue" },
  { path: "/reports/receivables", text: "Outstanding receivables" },
  { path: "/reports/payables", text: "Supplier payables" },
  { path: "/reports/profit", text: "Selected-period profit" },
] as const;

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email ?? "");
  await page.getByLabel("Password").fill(password ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/");
}

test.describe("Phase 1 release gate", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !email || !password,
      "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run authenticated release-gate tests.",
    );

    await signIn(page);
  });

  for (const route of criticalRoutes) {
    test(`loads ${route.path} without a runtime error`, async ({ page }) => {
      await page.goto(route.path);

      await expect(page.locator("main")).toContainText(route.text);
      await expect(page.locator("body")).not.toContainText("Runtime Error");
      await expect(page.locator("body")).not.toContainText("Error Type");
    });
  }

  test("keeps report period controls usable after applying a range", async ({
    page,
  }) => {
    await page.goto("/reports/payables");
    await page.getByLabel("Due from").fill("2026-01-01");
    await page.getByLabel("Due through").fill("2026-12-31");
    await page.getByRole("button", { name: "Apply filters" }).click();

    await expect(page).toHaveURL(/dueFrom=2026-01-01/);
    await expect(page.locator("main")).toContainText("Supplier payables");
  });
});
