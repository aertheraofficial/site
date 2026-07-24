-- Per-location stock overrides for catalog products.
-- Catalog products live in code; this table lets admin set an exact tracked
-- quantity / availability per (slug, location) from the Stock admin UI without a
-- code deploy. Only the admin backend (service role) touches it; RLS on, no policies.
--
-- IMPORTANT: setProductQuantity() upserts with onConflict "slug,location", so the
-- table MUST have a `location` column AND a UNIQUE (slug, location) constraint, or
-- saving stock fails with either:
--   "Could not find the 'location' column of 'product_stock'"        (column missing)
--   "there is no unique or exclusion constraint matching ON CONFLICT" (constraint missing)
--
-- This script is idempotent and also repairs an OLDER product_stock table that was
-- created without the location column / composite key.

create table if not exists public.product_stock (
  slug         text not null,
  location     text not null,
  availability text,
  quantity     integer,
  updated_at   timestamptz not null default timezone('utc', now())
);

-- Backfill any columns a partial/legacy table is missing (location included).
alter table public.product_stock add column if not exists location text;
alter table public.product_stock add column if not exists availability text;
alter table public.product_stock add column if not exists quantity integer;
alter table public.product_stock
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

-- Existing rows from the old (slug-only) schema belong to the online pool.
update public.product_stock set location = 'online' where location is null;

-- location is required going forward.
alter table public.product_stock alter column location set not null;

-- Drop a legacy slug-only PRIMARY KEY / UNIQUE constraint if present — it blocks
-- the same product from existing at more than one location and is not what the
-- upsert's ON CONFLICT (slug, location) targets.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.product_stock'::regclass
      and con.contype in ('p', 'u')
      and (
        select array_agg(a.attname order by a.attname)
        from unnest(con.conkey) k
        join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k
      ) = array['slug']
  loop
    execute format('alter table public.product_stock drop constraint %I', c.conname);
  end loop;
end $$;

-- Add the composite unique the upsert needs (if it isn't already there).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'product_stock_slug_location_key'
  ) then
    alter table public.product_stock
      add constraint product_stock_slug_location_key unique (slug, location);
  end if;
end $$;

alter table public.product_stock enable row level security;
revoke all on public.product_stock from anon, authenticated;

-- Atomic decrement used by the "Sold 1" quick action and post-order stock sync.
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

-- Force PostgREST to refresh its schema cache immediately (otherwise the API may
-- keep reporting the old "location column not found" until the next auto-reload).
notify pgrst, 'reload schema';
