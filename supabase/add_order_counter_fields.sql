-- Counter-sale fields on orders: who bought, which shop, which staff.
--
-- member_id: `orders.customer_id` is a FK to auth.users, so writing a walk-in
-- members id into it raised 23503 and the whole order fell back to the local
-- JSON file — invisible in /admin/orders and a 404 on the customer's receipt.
-- Walk-in buyers have no auth user, so they get their own column.
--
-- location / sold_by: the shop and the staff member were only ever written into
-- the free-text internal_notes, so sales could not be filtered or totalled per
-- shop or per staff.
alter table public.orders
  add column if not exists member_id uuid references public.members(id) on delete set null,
  add column if not exists location text,
  add column if not exists sold_by text,
  add column if not exists sold_by_name text;

create index if not exists orders_member_id_idx on public.orders (member_id);
create index if not exists orders_location_idx on public.orders (location);
create index if not exists orders_sold_by_idx on public.orders (sold_by);

-- Receipts are also looked up by contact details for pre-member orders.
create index if not exists orders_customer_phone_idx on public.orders (customer_phone);
