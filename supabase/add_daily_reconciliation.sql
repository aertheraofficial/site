-- Daily cash-up: match the bank statement and a physical stock count against
-- what the system recorded for a business date.
--
-- Two things are added:
--   1. orders.payment_method — how the money actually arrived. Until now the
--      counter only wrote it into internalNotes as free text ("paid via Cash"),
--      which cannot be trusted to split "should be in the bank" from "cash in
--      the drawer". Reconciliation depends entirely on that split.
--   2. daily_reconciliations — one row per (business date, location).
--
-- Safe to run more than once.

-- 1 ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists payment_method text;

create index if not exists orders_payment_method_idx
  on public.orders (payment_method);

-- 2 ---------------------------------------------------------------------------
create table if not exists public.daily_reconciliations (
  id                    text primary key,
  business_date         date not null,
  location              text not null,

  created_at            timestamptz not null default timezone('utc', now()),
  updated_at            timestamptz not null default timezone('utc', now()),
  created_by            text,

  -- Money side. All amounts in sen, like every other amount in this schema.
  expected_bank_amount  integer,
  statement_amount      integer,
  money_variance        integer,
  -- Storage object paths in the private "bank-statements" bucket.
  statement_image_paths jsonb not null default '[]'::jsonb,
  -- Transactions read off the statement, after a human confirmed them:
  -- [{ time, amount, reference, matchedSessionId }]
  statement_lines       jsonb not null default '[]'::jsonb,

  -- Stock side:
  -- [{ slug, name, sold, expectedOnHand, counted, variance }]
  stock_counts          jsonb not null default '[]'::jsonb,
  stock_variance_units  integer,

  -- draft | balanced | variance
  status                text not null default 'draft',
  notes                 text,

  -- One cash-up per day per till.
  constraint daily_reconciliations_date_location_key unique (business_date, location)
);

create index if not exists daily_reconciliations_date_idx
  on public.daily_reconciliations (business_date desc);

-- Server-side only, same as orders: the service role writes, nobody else reads.
alter table public.daily_reconciliations enable row level security;
revoke all on public.daily_reconciliations from anon, authenticated;

notify pgrst, 'reload schema';
