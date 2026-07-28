-- Staff roles + admin approval.
--
-- Before this, access was a raw list of page keys ticked one by one, and any
-- account could log in the moment it existed. Two changes:
--
-- role:   a named job (cashier, supervisor, ...) that decides both the pages
--         and how much of the sales data the holder may see. Permissions stay
--         in `permissions` so an admin can still override a single page.
-- status: pending -> active -> suspended. Accounts created through the public
--         /join form start pending and cannot log in until an admin approves,
--         so a leaked join link can never become access on its own.
alter table public.staff
  add column if not exists role text not null default 'cashier',
  add column if not exists approved_by text,
  add column if not exists approved_at timestamptz,
  -- Which shop a supervisor is responsible for. Null for roles that are not
  -- scoped to one shop.
  add column if not exists shop_location text;

-- Added as 'active' so the staff who already exist — all created by an admin by
-- hand, and so approved by definition — are not locked out on deploy. The
-- default flips to 'pending' immediately after, which is what new sign-ups get.
--
-- Done this way rather than with a backfill UPDATE on purpose: an UPDATE that
-- promotes pending rows would silently approve real pending applicants if this
-- file were ever run a second time. Both statements below are no-ops on a
-- re-run.
alter table public.staff
  add column if not exists status text not null default 'active';

alter table public.staff
  alter column status set default 'pending';

alter table public.staff
  drop constraint if exists staff_status_check;

alter table public.staff
  add constraint staff_status_check
  check (status in ('pending', 'active', 'suspended'));

create index if not exists staff_status_idx on public.staff (status);
