-- Customer profiles table
create table if not exists public.customer_profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text,
  address_line1 text,
  address_line2 text,
  city        text,
  state       text,
  postcode    text,
  country     text not null default 'MY',
  updated_at  timestamptz not null default timezone('utc', now())
);

alter table public.customer_profiles enable row level security;

revoke all on public.customer_profiles from anon, authenticated;
grant select, insert, update on public.customer_profiles to authenticated;

create policy "customers_manage_own_profile"
  on public.customer_profiles for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
