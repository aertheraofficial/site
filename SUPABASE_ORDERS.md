# Supabase Order Store

This storefront can store completed Stripe orders in either:

- `data/orders.json` when Supabase is not configured
- `Supabase` when both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set

The switch is automatic. This means you can stay on Stripe test mode and move only the
order store first.

## What to create in Supabase

1. Create a Supabase project.
2. Open the SQL Editor.
3. Run [`supabase/schema.sql`](./supabase/schema.sql).

This creates:

- `orders`
- `order_lines`

The tables are protected with RLS and have no client policies, so they are intended for
server-side writes only via the service role key.

## Environment variables

Add these to `.env.local` for local development:

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

Add the same two variables to Vercel for production.

The Stripe mode is independent:

- `sk_test_...` keeps checkout on sandbox
- `sk_live_...` switches checkout to live

So you can use Supabase with Stripe test mode first.

## What the app does

When Stripe checkout completes, the app records:

- customer name, email, and phone
- shipping address
- payment and checkout status
- subtotal, shipping, tax, and total
- every purchased line item

The webhook is the primary write path:

- `src/app/api/stripe/webhook/route.ts`

The success page also writes as a fallback:

- `src/app/checkout/success/page.tsx`

## Operational recommendation

Use the Supabase dashboard as the first order-tracking app:

- Table Editor for `orders`
- Table Editor for `order_lines`
- filters by `payment_status`, `customer_email`, or `ordered_at`

If you later want a branded internal dashboard, build it on top of the same tables rather
than replacing them.
