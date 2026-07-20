-- Editable overrides for catalog products.
-- Catalog products live in content/catalog.json (code-deployed). This table lets
-- admin change display fields (price, name, category, image, ...) from the admin
-- UI without a code deploy — each non-null column overrides the catalog value for
-- that slug; nulls fall back to the catalog. Mirrors public.product_stock.
-- Only the admin backend (service role) touches it; RLS on with no policies.
create table if not exists public.product_overrides (
  slug           text primary key,
  name           text,
  short_name     text,
  category_label text,
  size           text,
  price          numeric,
  image_url      text,
  availability   text,
  updated_at     timestamptz not null default timezone('utc', now())
);

alter table public.product_overrides enable row level security;
revoke all on public.product_overrides from anon, authenticated;
