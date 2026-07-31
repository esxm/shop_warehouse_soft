import { expect, test } from "@playwright/test";

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

test("filters the revenue report by a custom date range", async ({ page }) => {
  test.skip(
    !email || !password,
    "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run authenticated report tests.",
  );

  await page.goto("/login");
  await page.getByLabel("Email").fill(email ?? "");
  await page.getByLabel("Password").fill(password ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/");

  await page.goto("/reports");
  await page.getByLabel("From date").fill("2026-01-01");
  await page.getByLabel("To date").fill("2026-01-31");
  await page.getByRole("button", { name: "Apply range" }).click();

  await expect(page).toHaveURL(/\/reports\?from=2026-01-01&to=2026-01-31$/);
  await expect(
    page.getByText("Selected: 2026-01-01 through 2026-01-31"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Daily revenue" }),
  ).toBeVisible();
});
