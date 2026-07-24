-- Per-location stock overrides for catalog products.
-- Catalog products live in code; this table lets admin set an exact tracked
-- quantity / availability per (slug, location) from the Stock admin UI without a
-- code deploy. Only the admin backend (service role) touches it; RLS on, no policies.
--
-- IMPORTANT: setProductQuantity() upserts with onConflict "slug,location", so the
-- UNIQUE (slug, location) constraint below MUST exist or every "Set" save fails
-- with: "there is no unique or exclusion constraint matching the ON CONFLICT".

create table if not exists public.product_stock (
  slug         text not null,
  location     text not null,
  availability text,
  quantity     integer,
  updated_at   timestamptz not null default timezone('utc', now()),
  constraint product_stock_slug_location_key unique (slug, location)
);

-- If the table already existed without the composite unique constraint, add it.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'product_stock_slug_location_key'
  ) then
    alter table public.product_stock
      add constraint product_stock_slug_location_key unique (slug, location);
  end if;
end $$;

-- Backfill columns in case an older/partial table already exists.
alter table public.product_stock add column if not exists availability text;
alter table public.product_stock add column if not exists quantity integer;
alter table public.product_stock
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.product_stock enable row level security;
revoke all on public.product_stock from anon, authenticated;

-- Atomic decrement used by the "Sold 1" quick action and post-order stock sync.
-- Never drops below 0; keeps availability in sync with the resulting quantity.
create or replace function public.decrement_product_stock(
  p_slug     text,
  p_amount   integer,
  p_location text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.product_stock
     set quantity     = greatest(0, coalesce(quantity, 0) - p_amount),
         availability = case
                          when greatest(0, coalesce(quantity, 0) - p_amount) > 0
                            then 'In stock'
                          else 'Sold Out'
                        end,
         updated_at   = timezone('utc', now())
   where slug = p_slug
     and location = p_location;
end;
$$;

revoke all on function public.decrement_product_stock(text, integer, text)
  from anon, authenticated;
