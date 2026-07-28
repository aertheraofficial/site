-- Products added from the admin, on top of the static catalog in src/data.
--
-- src/lib/admin-products.ts has always read and written this table, but no
-- migration ever created it: "Add Product" failed with "Could not find the
-- table 'public.admin_products' in the schema cache", so the form could never
-- save. Reads were swallowed (getAdminProducts returns [] on error), which is
-- why the shop looked fine and only the create path complained.
--
-- Columns mirror AdminProductRow exactly. The storage bucket `product-images`
-- the form uploads to already exists and is public.
create table if not exists public.admin_products (
  -- The slug is the product's identity across the site: URLs, stock rows and
  -- order lines all reference it, so it is the key rather than a surrogate id.
  slug           text primary key,
  name           text not null,
  short_name     text not null,
  category_label text not null,
  size           text not null,
  -- Ringgit, not cents: the catalog in src/data/products.ts stores prices this
  -- way and both sources are read through the same Product type.
  price          numeric(10, 2) not null,
  excerpt        text not null default '',
  description    text not null default '',
  image_url      text not null default '',
  availability   text not null default 'In stock',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- getAdminProducts() orders by this, so the newest addition shows up first.
create index if not exists admin_products_created_at_idx
  on public.admin_products (created_at desc);

create index if not exists admin_products_category_idx
  on public.admin_products (category_label);

-- Reached only through the service-role key in server code; no anon access.
alter table public.admin_products enable row level security;
