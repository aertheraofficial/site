create table if not exists public.orders (
  session_id text primary key,
  order_id text not null,
  payment_intent_id text unique,
  ordered_at timestamptz not null,
  updated_at timestamptz not null default timezone('utc', now()),
  recorded_from text not null check (recorded_from in ('webhook', 'success-page')),
  customer_name text,
  customer_email text,
  customer_phone text,
  payment_status text,
  checkout_status text,
  currency text not null default 'myr',
  subtotal_amount integer,
  shipping_amount integer,
  tax_amount integer,
  total_amount integer,
  shipping_name text,
  shipping_address jsonb
);

create table if not exists public.order_lines (
  order_session_id text not null references public.orders(session_id) on delete cascade,
  line_position integer not null,
  description text not null,
  quantity integer not null,
  currency text not null,
  unit_amount integer,
  subtotal_amount integer,
  total_amount integer,
  primary key (order_session_id, line_position)
);

create index if not exists orders_ordered_at_idx on public.orders (ordered_at desc);
create index if not exists orders_customer_email_idx on public.orders (customer_email);
create index if not exists orders_payment_status_idx on public.orders (payment_status);

alter table public.orders enable row level security;
alter table public.order_lines enable row level security;

revoke all on public.orders from anon, authenticated;
revoke all on public.order_lines from anon, authenticated;

create table if not exists public.social_campaigns (
  id text primary key,
  title text not null,
  theme text not null,
  objective text not null,
  audience text not null,
  start_date date not null,
  end_date date not null,
  product_slugs text[] not null default '{}',
  content_pillars text[] not null default '{}',
  created_at timestamptz not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.social_posts (
  id text primary key,
  campaign_id text not null references public.social_campaigns(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'tiktok', 'facebook', 'x')),
  status text not null check (
    status in (
      'needs_review',
      'approved',
      'scheduled',
      'published',
      'manual_posted',
      'rejected',
      'failed'
    )
  ),
  scheduled_for timestamptz not null,
  pillar text not null,
  format text not null,
  goal text not null,
  caption text not null,
  visual_brief text not null,
  hashtags text[] not null default '{}',
  product_slugs text[] not null default '{}',
  product_url_path text,
  compliance_notes text[] not null default '{}',
  reviewer_flags text[] not null default '{}',
  approval_notes text,
  published_url text,
  external_post_id text,
  manual_posted_at timestamptz,
  prompt_input jsonb,
  model_output jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.social_publishing_accounts (
  id text primary key,
  platform text not null check (platform in ('instagram', 'tiktok', 'facebook', 'x')),
  handle text not null,
  status text not null check (status in ('manual', 'connected', 'needs_setup', 'disabled')),
  token_ref text,
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.social_publishing_jobs (
  id text primary key,
  post_id text not null references public.social_posts(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'tiktok', 'facebook', 'x')),
  status text not null check (status in ('queued', 'blocked', 'sent', 'failed')),
  run_after timestamptz,
  result jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.social_post_metrics (
  id text primary key,
  post_id text not null references public.social_posts(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'tiktok', 'facebook', 'x')),
  captured_at timestamptz not null,
  impressions integer,
  engagements integer,
  clicks integer,
  saves integer,
  shares integer,
  comments integer,
  raw jsonb
);

create index if not exists social_campaigns_start_date_idx
  on public.social_campaigns (start_date desc);
create index if not exists social_posts_campaign_id_idx
  on public.social_posts (campaign_id);
create index if not exists social_posts_status_idx
  on public.social_posts (status);
create index if not exists social_posts_platform_scheduled_idx
  on public.social_posts (platform, scheduled_for);
create index if not exists social_publishing_jobs_status_run_after_idx
  on public.social_publishing_jobs (status, run_after);
create index if not exists social_post_metrics_post_captured_idx
  on public.social_post_metrics (post_id, captured_at desc);

alter table public.social_campaigns enable row level security;
alter table public.social_posts enable row level security;
alter table public.social_publishing_accounts enable row level security;
alter table public.social_publishing_jobs enable row level security;
alter table public.social_post_metrics enable row level security;

revoke all on public.social_campaigns from anon, authenticated;
revoke all on public.social_posts from anon, authenticated;
revoke all on public.social_publishing_accounts from anon, authenticated;
revoke all on public.social_publishing_jobs from anon, authenticated;
revoke all on public.social_post_metrics from anon, authenticated;
