-- Data carried over from the standalone medsoc SQLite database.
--
-- Run this AFTER add_social_studio.sql. It is the whole migration: that
-- database held 2 links, 0 posts and 0 analytics rows, so there is nothing else
-- to bring across.
--
-- Two things were deliberately left behind:
--
--   users     — one login for the old standalone app. Access is the site's
--               staff accounts now, so a second user table would be a second
--               way in with its own password to forget about.
--   settings  — three rows: GEMINI_API_KEY, META_IG_ACCOUNT_ID, META_PAGE_ID.
--               Secrets belong in environment variables, not in a table any
--               `social` user could read. Set GEMINI_API_KEY in the environment
--               instead; the Meta ids already have their own env vars here.
--
-- Safe to run twice: the guard skips the insert if the links are already there.

insert into public.studio_links
  (title, url, platform, icon, is_active, sort_order, click_count)
select * from (values
  ('Instagram', 'https://www.instagram.com/aerthera.official', 'instagram', null::text, true, 0, 0),
  ('Facebook',  'https://www.facebook.com/aerthera.official',  'facebook',  null::text, true, 1, 0)
) as seed(title, url, platform, icon, is_active, sort_order, click_count)
where not exists (
  select 1 from public.studio_links where url = seed.url
);
