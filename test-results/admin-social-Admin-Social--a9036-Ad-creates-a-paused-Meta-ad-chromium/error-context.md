# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin-social.spec.ts >> Admin Social — full ad pipeline (optional) >> Generate Paid Ad creates a paused Meta ad
- Location: e2e/admin-social.spec.ts:61:7

# Error details

```
Error: unexpected publish error at http://127.0.0.1:3000/admin/social?error=meta-billing-missing

expect(received).toBeNull()

Received: "meta-billing-missing"
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e6]:
        - generic [ref=e7]:
          - paragraph [ref=e8]: Aerthera Admin
          - generic [ref=e9]:
            - heading "Order Management" [level=1] [ref=e10]
            - generic [ref=e11]: admin
        - generic [ref=e12]:
          - link "Orders" [ref=e13] [cursor=pointer]:
            - /url: /admin/orders
          - link "Social" [ref=e14] [cursor=pointer]:
            - /url: /admin/social
          - link "View Store" [ref=e15] [cursor=pointer]:
            - /url: /category/all-products
          - button "Log Out" [ref=e17] [cursor=pointer]
    - main [ref=e18]:
      - generic [ref=e20]:
        - generic [ref=e21]:
          - article [ref=e22]:
            - paragraph [ref=e23]: Attempts
            - paragraph [ref=e24]: "11"
            - paragraph [ref=e25]: Each attempt generates, reviews, and creates a paused paid ad.
          - article [ref=e26]:
            - paragraph [ref=e27]: Posted
            - paragraph [ref=e28]: "1"
            - paragraph [ref=e29]: Published or marked manually posted.
        - generic [ref=e30]:
          - generic [ref=e31]:
            - generic [ref=e32]:
              - paragraph [ref=e33]: Social Agent
              - heading "Generate, review, create ads" [level=2] [ref=e34]
              - paragraph [ref=e35]: Pick one product. The agent writes the paid ad, checks brand guardrails, creates the campaign/ad set/creative/ad in Meta for Facebook and Instagram, and leaves everything paused so it cannot spend until you activate it.
            - generic [ref=e36]:
              - generic [ref=e37]: Creates a paused Meta ad with Facebook Feed and Instagram Feed/Explore placements. The ad uses a Shop Now button linked to the selected product page and will not spend until activated in Ads Manager.
              - generic [ref=e38]:
                - text: Placements
                - combobox "Placements" [disabled] [ref=e39]:
                  - option "Facebook + Instagram" [selected]
              - generic [ref=e40]:
                - text: Product
                - combobox "Product" [ref=e41]:
                  - option "Body Cleanse Shower Gel · RM 116.00" [selected]
                  - option "Body Cleanse Shower Oil · RM 116.00"
                  - option "Calm Mousseline · RM 62.00"
                  - option "Calm Mousseline · RM 26.00"
                  - option "Body Oil · RM 107.00"
                  - option "Hair Root Serum · RM 107.00"
                  - option "Reed Diffuser · RM 199.00"
                  - option "Scented Candle · RM 249.00"
                  - option "Essential Oil · RM 99.00"
                  - option "Scented Spray · RM 107.00"
                  - option "Body Cleanse Shower Gel · RM 116.00"
                  - option "Body Cleanse Shower Oil · RM 116.00"
                  - option "Calm Mousseline · RM 62.00"
                  - option "Calm Mousseline · RM 26.00"
                  - option "Body Oil · RM 107.00"
                  - option "Hair Root Serum · RM 107.00"
                  - option "Reed Diffuser · RM 199.00"
                  - option "Scented Candle · RM 249.00"
              - paragraph [ref=e42]
              - button "Generate Paid Ad" [ref=e43] [cursor=pointer]:
                - generic [ref=e44]: Generate Paid Ad
          - paragraph [ref=e45]: Meta ad account billing is not ready. Add a valid payment method in Meta Billing and Payment Center for this ad account, then try again. See the latest result below for details.
        - generic [ref=e46]:
          - paragraph [ref=e47]: Latest Result
          - heading "Last generated ad" [level=2] [ref=e48]
          - article [ref=e50]:
            - generic [ref=e51]:
              - generic [ref=e52]: failed
              - generic [ref=e53]: facebook
              - generic [ref=e54]: 28 Apr 2026, 5:28 pm
            - generic [ref=e55]:
              - generic [ref=e56]:
                - paragraph [ref=e57]: Caption
                - textbox [ref=e58]: "Lemongrass Malaya, in its most practical ritual: the first step in your shower. Our Body Cleanse Shower Gel (230ml) opens with lemongrass, green citrus, and a sunlit stem freshness—made for mornings that need a clean reset without rushing. How to use: • Start with it in the shower to bring the scent collection onto skin • Rinse fully, then layer with a body or home format in the same scent family • Keep it by the sink or bath for the easiest daily reach Pre-order • RM 116 • lead time 7–14 working days. Save this for your next reset, or explore the Lemongrass collection via the link in bio. #Aerthera #AromatherapyRitual #ShowerRitual #ScentLayering #Lemongrass #GreenCitrus #DailyReset #WellnessRitual"
              - generic [ref=e60]:
                - paragraph [ref=e61]: Visual Brief
                - paragraph [ref=e62]: "Premium, nature-led bathroom scene with soft morning light. Product hero: Aerthera Body Cleanse Shower Gel Lemongrass Malaya 230ml placed on a stone/terrazzo ledge with a few water droplets. Supporting elements: a fresh lemongrass stalk and a subtle green citrus peel accent in the background (not dominant). Palette: warm neutrals + fresh green. Composition: clean, minimal, ample negative space for caption overlay. Avoid medical cues; focus on ritual and sensory freshness."
            - generic [ref=e63]: "No medical/therapeutic claims; language stays in atmosphere/ritual territory. Availability clearly flagged as Pre-order with lead time (7–14 working days). Only uses provided product facts: name, size (230ml), price (RM 116.00), scent notes, and ritual steps. Avoids prohibited claims (e.g., cure/treat/heal/clinically proven/guaranteed sleep). Grounded in catalog facts for product, availability, scent notes, and price. Automated checks must pass before publishing runs."
            - paragraph [ref=e65]: Meta ad account act_981242547656873 has no payment method. Add a valid payment method in Meta Billing and Payment Center for this ad account, then try again.
  - button "Open Next.js Dev Tools" [ref=e71] [cursor=pointer]:
    - img [ref=e72]
  - alert [ref=e75]
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | function adminPassword() {
  4  |   return (
  5  |     process.env.E2E_ADMIN_PASSWORD?.trim() ||
  6  |     process.env.ADMIN_PASSWORD?.trim() ||
  7  |     ""
  8  |   );
  9  | }
  10 | 
  11 | test.describe("Admin Social", () => {
  12 |   test.beforeEach(({ }, testInfo) => {
  13 |     if (!adminPassword()) {
  14 |       testInfo.skip(true, "Set ADMIN_PASSWORD or E2E_ADMIN_PASSWORD (or add .env.local).");
  15 |     }
  16 |   });
  17 | 
  18 |   test("login → Social page shows agent form and latest-result region", async ({ page }) => {
  19 |     await page.goto("/admin/login?next=/admin/social");
  20 | 
  21 |     await expect(page.getByRole("heading", { name: "Orders and fulfillment" })).toBeVisible();
  22 | 
  23 |     await page.getByTestId("admin-password").fill(adminPassword());
  24 |     await page.getByRole("button", { name: "Enter Admin" }).click();
  25 | 
  26 |     await page.waitForURL("**/admin/social", { timeout: 30_000 });
  27 | 
  28 |     await expect(page.getByRole("heading", { name: "Generate, review, create ads" })).toBeVisible();
  29 |     await expect(page.getByTestId("social-agent-form")).toBeVisible();
  30 |     await expect(page.getByTestId("social-platform")).toBeVisible();
  31 |     await expect(page.getByTestId("social-product")).toBeVisible();
  32 |     await expect(page.getByTestId("social-submit")).toBeVisible();
  33 |     await expect(page.getByTestId("social-latest-result")).toBeVisible();
  34 |   });
  35 | 
  36 |   test("nav: login to orders then Social link reaches social page", async ({ page }) => {
  37 |     await page.goto("/admin/login");
  38 | 
  39 |     await page.getByTestId("admin-password").fill(adminPassword());
  40 |     await page.getByRole("button", { name: "Enter Admin" }).click();
  41 | 
  42 |     await page.waitForURL("**/admin/orders", { timeout: 30_000 });
  43 | 
  44 |     await page.getByRole("link", { name: "Social" }).click();
  45 |     await page.waitForURL("**/admin/social", { timeout: 15_000 });
  46 | 
  47 |     await expect(page.getByRole("heading", { name: "Generate, review, create ads" })).toBeVisible();
  48 |   });
  49 | });
  50 | 
  51 | test.describe("Admin Social — full ad pipeline (optional)", () => {
  52 |   test.beforeEach(({ }, testInfo) => {
  53 |     if (!process.env.E2E_SOCIAL_FULL) {
  54 |       testInfo.skip(true, "Set E2E_SOCIAL_FULL=1 to run live AI + Meta ad creation (slow, uses real APIs).");
  55 |     }
  56 |     if (!adminPassword()) {
  57 |       testInfo.skip(true, "Set ADMIN_PASSWORD or E2E_ADMIN_PASSWORD.");
  58 |     }
  59 |   });
  60 | 
  61 |   test("Generate Paid Ad creates a paused Meta ad", async ({
  62 |     page,
  63 |   }) => {
  64 |     test.setTimeout(200_000);
  65 |     await page.goto("/admin/login?next=/admin/social");
  66 |     await page.getByTestId("admin-password").fill(adminPassword());
  67 |     await page.getByRole("button", { name: "Enter Admin" }).click();
  68 |     await page.waitForURL("**/admin/social", { timeout: 30_000 });
  69 | 
  70 |     await page.getByTestId("social-submit").click();
  71 |     await expect(page.getByTestId("social-submit")).toContainText("Creating Ad");
  72 |     await expect(page.getByTestId("social-submit-status")).toContainText(
  73 |       "creating a paused Meta ad",
  74 |     );
  75 | 
  76 |     await page.waitForFunction(
  77 |       () => {
  78 |         const s = new URLSearchParams(window.location.search);
  79 |         return s.has("adCreated") || s.has("error");
  80 |       },
  81 |       { timeout: 180_000 },
  82 |     );
  83 | 
  84 |     const url = new URL(page.url());
  85 |     const error = url.searchParams.get("error");
  86 | 
> 87 |     expect(error, `unexpected publish error at ${url.href}`).toBeNull();
     |                                                              ^ Error: unexpected publish error at http://127.0.0.1:3000/admin/social?error=meta-billing-missing
  88 |     expect(url.searchParams.get("adCreated")).toBe("1");
  89 |     await expect(page.getByTestId("social-feedback-success")).toBeVisible();
  90 | 
  91 |     await expect(page.getByTestId("social-latest-result")).toBeVisible();
  92 |   });
  93 | });
  94 | 
```