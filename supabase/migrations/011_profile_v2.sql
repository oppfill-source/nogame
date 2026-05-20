-- ─────────────────────────────────────────────────────────────────────────────
-- 011: Profile v2 — identity fields, preferences, notification settings.
-- All columns nullable / have defaults so existing rows stay valid.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists display_name        text,
  add column if not exists bio                 text,
  add column if not exists default_odds_format text default 'american',
  add column if not exists theme               text default 'dark',
  add column if not exists notification_prefs  jsonb default '{"high_value_picks": true, "comments_on_my_picks": true, "new_followers": true}'::jsonb;

-- Public read of display_name/bio is fine — profiles policy already allows it.
