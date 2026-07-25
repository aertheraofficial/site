-- Staff accounts (counter staff, etc.) with per-page admin access, plus their
-- payslips. Passwords are hashed by the app (Node scrypt) before storage.
-- Only the admin backend (service role) touches these; RLS on, no policies.

create table if not exists public.staff (
  id            uuid primary key default gen_random_uuid(),
  username      text not null unique,
  password_hash text not null,
  full_name     text not null,
  position      text,
  phone         text,
  email         text,
  ic_number     text,
  bank_name     text,
  bank_account  text,
  join_date     date,
  base_salary   numeric,
  -- Array of page keys from src/lib/staff-permissions.ts (e.g. {counter-sale,stock}).
  permissions   text[] not null default '{}',
  is_active     boolean not null default true,
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now())
);

create index if not exists staff_username_idx on public.staff (lower(username));

alter table public.staff enable row level security;
revoke all on public.staff from anon, authenticated;

create table if not exists public.payslips (
  id               uuid primary key default gen_random_uuid(),
  staff_id         uuid not null references public.staff (id) on delete cascade,
  period_month     integer not null check (period_month between 1 and 12),
  period_year      integer not null,
  basic            numeric not null default 0,
  allowances       numeric not null default 0,
  epf_employee     numeric not null default 0,
  epf_employer     numeric not null default 0,
  socso_employee   numeric not null default 0,
  eis_employee     numeric not null default 0,
  pcb              numeric not null default 0,
  other_deductions numeric not null default 0,
  gross            numeric not null default 0,
  net              numeric not null default 0,
  notes            text,
  issued_at        timestamptz,
  created_at       timestamptz not null default timezone('utc', now()),
  updated_at       timestamptz not null default timezone('utc', now()),
  constraint payslips_staff_period_key unique (staff_id, period_year, period_month)
);

create index if not exists payslips_staff_idx on public.payslips (staff_id);

alter table public.payslips enable row level security;
revoke all on public.payslips from anon, authenticated;

notify pgrst, 'reload schema';
