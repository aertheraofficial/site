import { expect, test } from "@playwright/test";

function adminPassword() {
  return (
    process.env.E2E_ADMIN_PASSWORD?.trim() ||
    process.env.ADMIN_PASSWORD?.trim() ||
    ""
  );
}

async function login(page: import("@playwright/test").Page, next: string) {
  await page.goto(`/admin/login?next=${encodeURIComponent(next)}`);
  await page.getByTestId("admin-password").fill(adminPassword());
  await page.getByRole("button", { name: "Enter Admin" }).click();
  await page.waitForURL(`**${next}`, { timeout: 30_000 });
}

test.describe("Admin Customers", () => {
  test.beforeEach(({}, testInfo) => {
    if (!adminPassword()) {
      testInfo.skip(true, "Set ADMIN_PASSWORD or E2E_ADMIN_PASSWORD (or add .env.local).");
    }
  });

  test("customer book lists customers and opens their receipts", async ({ page }) => {
    await login(page, "/admin/customers");

    await expect(page.getByRole("heading", { name: "Customer Book" })).toBeVisible();

    const firstReceiptsLink = page.getByRole("link", { name: "Receipts" }).first();
    await expect(firstReceiptsLink).toBeVisible();
    await firstReceiptsLink.click();

    await page.waitForURL("**/admin/customers/**", { timeout: 15_000 });
    await expect(page.getByRole("link", { name: "← Customer Book" })).toBeVisible();
  });

  /**
   * Regression: the typeahead used to call /api/admin/members/search, which the
   * admin cookie (scoped to path=/admin) never reached — every lookup 401'd and
   * the counter silently showed nothing. It now searches the whole customer
   * book, so people who bought without registering are findable too.
   */
  test("counter sale finds an existing customer by phone", async ({ page }) => {
    await login(page, "/admin/counter-sale");

    const search = page.getByPlaceholder("Find member by name or phone");
    await expect(search).toBeVisible();
    await search.fill("017");

    await expect(
      page.locator("button", { hasText: /01\d/ }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("counter sale takes a percentage off the total", async ({ page }) => {
    await login(page, "/admin/counter-sale");

    const product = page.getByPlaceholder("Search product by name");
    await product.fill("a");
    await page.locator("button", { hasText: "RM" }).first().click();

    const summary = page.locator("div", { hasText: "Sale Summary" }).last();
    await page.getByRole("button", { name: "30%", exact: true }).click();

    await expect(summary.getByText("Subtotal")).toBeVisible();
    await expect(summary.getByText("Discount 30%")).toBeVisible();
  });
});
