import { expect, test } from "@playwright/test";

function adminPassword() {
  return (
    process.env.E2E_ADMIN_PASSWORD?.trim() ||
    process.env.ADMIN_PASSWORD?.trim() ||
    ""
  );
}

test.describe("Admin Social", () => {
  test.beforeEach(({ }, testInfo) => {
    if (!adminPassword()) {
      testInfo.skip(true, "Set ADMIN_PASSWORD or E2E_ADMIN_PASSWORD (or add .env.local).");
    }
  });

  test("login → Social page shows agent form and latest-result region", async ({ page }) => {
    await page.goto("/admin/login?next=/admin/social");

    await expect(page.getByRole("heading", { name: "Orders and fulfillment" })).toBeVisible();

    await page.getByTestId("admin-password").fill(adminPassword());
    await page.getByRole("button", { name: "Enter Admin" }).click();

    await page.waitForURL("**/admin/social", { timeout: 30_000 });

    await expect(page.getByRole("heading", { name: "Generate, review, create ads" })).toBeVisible();
    await expect(page.getByTestId("social-agent-form")).toBeVisible();
    await expect(page.getByTestId("social-platform")).toBeVisible();
    await expect(page.getByTestId("social-product")).toBeVisible();
    await expect(page.getByTestId("social-submit")).toBeVisible();
    await expect(page.getByTestId("social-latest-result")).toBeVisible();
  });

  test("nav: login to orders then Social link reaches social page", async ({ page }) => {
    await page.goto("/admin/login");

    await page.getByTestId("admin-password").fill(adminPassword());
    await page.getByRole("button", { name: "Enter Admin" }).click();

    await page.waitForURL("**/admin/orders", { timeout: 30_000 });

    await page.getByRole("link", { name: "Social" }).click();
    await page.waitForURL("**/admin/social", { timeout: 15_000 });

    await expect(page.getByRole("heading", { name: "Generate, review, create ads" })).toBeVisible();
  });
});

test.describe("Admin Social — full ad pipeline (optional)", () => {
  test.beforeEach(({ }, testInfo) => {
    if (!process.env.E2E_SOCIAL_FULL) {
      testInfo.skip(true, "Set E2E_SOCIAL_FULL=1 to run live AI + Meta ad creation (slow, uses real APIs).");
    }
    if (!adminPassword()) {
      testInfo.skip(true, "Set ADMIN_PASSWORD or E2E_ADMIN_PASSWORD.");
    }
  });

  test("Generate Paid Ad creates a paused Meta ad", async ({
    page,
  }) => {
    test.setTimeout(200_000);
    await page.goto("/admin/login?next=/admin/social");
    await page.getByTestId("admin-password").fill(adminPassword());
    await page.getByRole("button", { name: "Enter Admin" }).click();
    await page.waitForURL("**/admin/social", { timeout: 30_000 });

    await page.getByTestId("social-submit").click();
    await expect(page.getByTestId("social-submit")).toContainText("Creating Ad");
    await expect(page.getByTestId("social-submit-status")).toContainText(
      "creating a paused Meta ad",
    );

    await page.waitForFunction(
      () => {
        const s = new URLSearchParams(window.location.search);
        return s.has("adCreated") || s.has("error");
      },
      { timeout: 180_000 },
    );

    const url = new URL(page.url());
    const error = url.searchParams.get("error");

    expect(error, `unexpected publish error at ${url.href}`).toBeNull();
    expect(url.searchParams.get("adCreated")).toBe("1");
    await expect(page.getByTestId("social-feedback-success")).toBeVisible();

    await expect(page.getByTestId("social-latest-result")).toBeVisible();
  });
});
