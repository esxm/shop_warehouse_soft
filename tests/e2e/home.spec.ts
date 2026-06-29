import { expect, test } from "@playwright/test";

test("shows the responsive project foundation", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Shop and warehouse management",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Primary navigation" }),
  ).toBeVisible();
});

test("returns a redacted Supabase health response", async ({ request }) => {
  const response = await request.get("/api/health/supabase");
  const payload: unknown = await response.json();

  expect([200, 503]).toContain(response.status());
  expect(payload).toEqual({
    service: "supabase",
    status: response.ok() ? "ok" : "unavailable",
  });
  expect(JSON.stringify(payload)).not.toContain("local-development");
});
