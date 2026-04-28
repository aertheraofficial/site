# Aerthera Storefront

Custom Next.js storefront for the Aerthera Lemongrass Malaya range.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

For a production build check:

```bash
npm run build
npm run start
```

## Content source

Editable storefront content lives in:

- `content/catalog.json`: products and category pages
- `content/site.json`: site identity, homepage copy, privacy policy, and accessibility statement

Static media lives in `public/assets`.

## Checkout configuration

Stripe checkout is implemented with guest checkout and hosted payment pages.

Copy `.env.example` to `.env.local` and set at least:

- `NEXT_PUBLIC_SITE_URL`
- `STRIPE_MODE`
- `STRIPE_SECRET_KEY_TEST`
- `STRIPE_WEBHOOK_SECRET_TEST`

If you also want live mode ready without overwriting the sandbox keys, add:

- `STRIPE_SECRET_KEY_LIVE`
- `STRIPE_WEBHOOK_SECRET_LIVE`

Recommended switching setup:

```env
STRIPE_MODE=test
STRIPE_SECRET_KEY_TEST=sk_test_...
STRIPE_WEBHOOK_SECRET_TEST=whsec_...
STRIPE_SECRET_KEY_LIVE=sk_live_...
STRIPE_WEBHOOK_SECRET_LIVE=whsec_...
```

Then switch modes by changing only:

```env
STRIPE_MODE=live
```

Optional checkout settings:

- `STRIPE_ENABLE_AUTOMATIC_TAX`
- `STRIPE_ALLOWED_SHIPPING_COUNTRIES`
- `STRIPE_SHIPPING_STANDARD_LABEL`
- `STRIPE_SHIPPING_STANDARD_AMOUNT`
- `STRIPE_SHIPPING_EXPRESS_LABEL`
- `STRIPE_SHIPPING_EXPRESS_AMOUNT`

Optional order-store settings:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Social agent workflow

The protected admin area includes `/admin/social` for agent-assisted social media planning.
It reads the storefront content in `content/site.json` and `content/catalog.json`, generates
platform-specific drafts, applies brand/compliance guardrails, and keeps every draft in an
approval queue before anything is posted.

By default, drafts use a deterministic generator so the workflow works without AI credentials.
To enable AI-assisted variants through the AI SDK / Vercel AI Gateway, set:

- `SOCIAL_AGENT_MODEL`
- `AI_GATEWAY_API_KEY`

Drafts are stored in Supabase when the social tables from `supabase/schema.sql` are applied.
Otherwise the app falls back to `SOCIAL_STORAGE_PATH` just like order storage falls back to
`ORDER_STORAGE_PATH`.

Optional social publishing setup values are included in `.env.example`. Direct publishing is
intentionally staged: Meta can be connected first for Instagram/Facebook, TikTok requires
Content Posting API approval, and X should only be connected if paid API access is justified.

For scheduled generation, call:

```bash
curl -X POST "$NEXT_PUBLIC_SITE_URL/api/social/cron/weekly-plan" \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Orders

Completed orders are recorded by the Stripe webhook and also from the success page as a fallback.

Order storage works in two modes:

- default fallback: `data/orders.json`
- production-ready option: `Supabase`

When both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present, the app writes
orders to Supabase automatically. Otherwise it falls back to `data/orders.json`.

Supabase setup notes and the SQL schema are in:

- `SUPABASE_ORDERS.md`
- `supabase/schema.sql`

## Quality checks

```bash
npm run lint
npm run build
```
