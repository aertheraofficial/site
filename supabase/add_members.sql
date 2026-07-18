-- Walk-in members (Destina kiosk).
-- Separate from customer_profiles, which is tied to an authenticated online
-- account (user_id references auth.users). Kiosk staff register members on the
-- spot with no auth signup, so these rows have no auth user. Only the admin
-- backend (service role) touches this table; RLS is on with no policies, so
-- anon/authenticated clients get nothing and the service role bypasses RLS.
create table if not exists public.members (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  phone       text,
  email       text,
  location    text,
  notes       text,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

create index if not exists members_phone_idx      on public.members (phone);
create index if not exists members_full_name_idx   on public.members (lower(full_name));
create index if not exists members_email_idx        on public.members (lower(email));

alter table public.members enable row level security;
revoke all on public.members from anon, authenticated;
