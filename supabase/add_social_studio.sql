-- Social Studio: the organic side of the Social tab.
--
-- Ported from the standalone aertheramedsoc NestJS/TypeORM service, which kept
-- these four tables in its own SQLite file. Bringing them here puts every
-- social tool behind one login, one permission (`social`) and one database.
--
-- Named `studio_*`, not `social_*`, on purpose: `social_posts` and
-- `social_campaigns` already exist and belong to the paid-ads side (AI drafts,
-- approval queue, Meta ad objects). The two systems live side by side as
-- sub-tabs and must not share tables — an organic post and a paid ad draft have
-- different lifecycles and different approval rules.
--
-- Types translated from TypeORM: `simple-array` (a comma-joined string in
-- SQLite) becomes a real Postgres text[], and every timestamp becomes timestamptz
-- so a post scheduled for 9pm means 9pm in Kuala Lumpur regardless of where the
-- server runs. See src/lib/datetime.ts.

-- --- Posts ------------------------------------------------------------------

create table if not exists public.studio_posts (
  id bigint generated always as identity primary key,
  title text not null,
  content text not null,
  caption text,
  -- Cross-posting is the point: one post can target several networks at once.
  platforms text[] not null default '{}',
  status text not null default 'draft',
  scheduled_at timestamptz,
  published_at timestamptz,
  media_urls text[] not null default '{}',
  niche text,
  -- Who wrote it. Staff id from public.staff, or 'admin' for the master
  -- account; the old service had no concept of this because it had its own
  -- single-user login.
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.studio_posts
  drop constraint if exists studio_posts_status_check;

alter table public.studio_posts
  add constraint studio_posts_status_check
  check (status in ('draft', 'scheduled', 'published', 'failed'));

-- The queue view is "what is due next", so scheduled_at leads.
create index if not exists studio_posts_scheduled_idx
  on public.studio_posts (scheduled_at)
  where status = 'scheduled';

create index if not exists studio_posts_status_idx on public.studio_posts (status);

-- --- Link tree --------------------------------------------------------------

create table if not exists public.studio_links (
  id bigint generated always as identity primary key,
  title text not null,
  url text not null,
  platform text not null default 'instagram',
  icon text,
  is_active boolean not null default true,
  -- `order` is reserved in SQL, so the TypeORM `order` column becomes
  -- sort_order here.
  sort_order integer not null default 0,
  click_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists studio_links_order_idx
  on public.studio_links (sort_order)
  where is_active;

-- --- Analytics --------------------------------------------------------------

create table if not exists public.studio_analytics (
  id bigint generated always as identity primary key,
  platform text not null,
  event_type text not null default 'link_click',
  -- Deliberately not foreign keys: an analytics row is a historical fact and
  -- must survive the post or link it refers to being deleted.
  post_id bigint,
  link_id bigint,
  referrer text,
  user_agent text,
  created_at timestamptz not null default now()
);

-- Every analytics screen is "events over a date range", optionally per link.
create index if not exists studio_analytics_created_idx
  on public.studio_analytics (created_at desc);

create index if not exists studio_analytics_link_idx
  on public.studio_analytics (link_id, created_at desc);

-- --- Settings ---------------------------------------------------------------

create table if not exists public.studio_settings (
  id bigint generated always as identity primary key,
  key text not null unique,
  value text,
  updated_at timestamptz not null default now()
);

-- --- Access -----------------------------------------------------------------
--
-- Reached only through the admin server actions, which run on the service role
-- behind requirePermission('social'). RLS on with no policy means the anon and
-- authenticated keys cannot read these tables at all, which is what we want:
-- the storefront has no business reading the marketing queue.
alter table public.studio_posts enable row level security;
alter table public.studio_links enable row level security;
alter table public.studio_analytics enable row level security;
alter table public.studio_settings enable row level security;
