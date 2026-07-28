-- Social Studio — schema + seed data, in one run.
--
-- Paste the whole file into Supabase → SQL Editor → Run. Safe to run more than
-- once: every table uses `create table if not exists`, and the seed at the
-- bottom is guarded so the links cannot be inserted twice.
--
-- This is add_social_studio.sql and seed_social_studio_links.sql combined; those
-- two files remain the source of truth for anyone reading the history.
--
-- Named `studio_*` rather than `social_*` on purpose: `social_posts` and
-- `social_campaigns` already exist and belong to the paid-ads side. The organic
-- tools and the paid-ad queue sit side by side and must not share tables.

-- ---------- Posts ----------------------------------------------------------

create table if not exists public.studio_posts (
  id bigint generated always as identity primary key,
  title text not null,
  content text not null,
  caption text,
  -- One post can target several networks at once.
  platforms text[] not null default '{}',
  status text not null default 'draft',
  -- timestamptz throughout, so "9pm" means 9pm in Kuala Lumpur wherever the
  -- server happens to run. See src/lib/datetime.ts.
  scheduled_at timestamptz,
  published_at timestamptz,
  media_urls text[] not null default '{}',
  niche text,
  -- Staff id from public.staff, or 'admin' for the master account.
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.studio_posts
  drop constraint if exists studio_posts_status_check;

alter table public.studio_posts
  add constraint studio_posts_status_check
  check (status in ('draft', 'scheduled', 'published', 'failed'));

create index if not exists studio_posts_scheduled_idx
  on public.studio_posts (scheduled_at)
  where status = 'scheduled';

create index if not exists studio_posts_status_idx
  on public.studio_posts (status);

-- ---------- Link tree ------------------------------------------------------

create table if not exists public.studio_links (
  id bigint generated always as identity primary key,
  title text not null,
  url text not null,
  platform text not null default 'instagram',
  icon text,
  is_active boolean not null default true,
  -- `order` is reserved in SQL, hence sort_order.
  sort_order integer not null default 0,
  click_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists studio_links_order_idx
  on public.studio_links (sort_order)
  where is_active;

-- ---------- Analytics ------------------------------------------------------

create table if not exists public.studio_analytics (
  id bigint generated always as identity primary key,
  platform text not null,
  event_type text not null default 'link_click',
  -- Not foreign keys on purpose: an analytics row is a historical fact and must
  -- survive the post or link it refers to being deleted.
  post_id bigint,
  link_id bigint,
  referrer text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists studio_analytics_created_idx
  on public.studio_analytics (created_at desc);

create index if not exists studio_analytics_link_idx
  on public.studio_analytics (link_id, created_at desc);

-- ---------- Settings -------------------------------------------------------

create table if not exists public.studio_settings (
  id bigint generated always as identity primary key,
  key text not null unique,
  value text,
  updated_at timestamptz not null default now()
);

-- ---------- Access ---------------------------------------------------------
--
-- RLS on with no policy: the anon and authenticated keys cannot read these at
-- all. Everything goes through the admin server actions, which run on the
-- service role behind requirePermission('social').

alter table public.studio_posts enable row level security;
alter table public.studio_links enable row level security;
alter table public.studio_analytics enable row level security;
alter table public.studio_settings enable row level security;

-- ---------- Seed: links from the old medsoc SQLite -------------------------
--
-- That database held 2 links, 0 posts and 0 analytics rows — this is the whole
-- data migration. Its `users` table (one login) and `settings` table (API keys
-- in plaintext) are deliberately not carried over.
--
-- Change these two URLs if they are not the real accounts.

insert into public.studio_links
  (title, url, platform, icon, is_active, sort_order, click_count)
select * from (values
  ('Instagram', 'https://www.instagram.com/aerthera.official', 'instagram', null::text, true, 0, 0),
  ('Facebook',  'https://www.facebook.com/aerthera.official',  'facebook',  null::text, true, 1, 0)
) as seed(title, url, platform, icon, is_active, sort_order, click_count)
where not exists (
  select 1 from public.studio_links where url = seed.url
);
