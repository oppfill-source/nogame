-- 004_ai_picks_enhancement.sql
-- Adds richer data columns to ai_picks for odds comparison and confidence %

alter table public.ai_picks
  add column if not exists odds_data jsonb,
  add column if not exists confidence_pct integer
    check (confidence_pct >= 0 and confidence_pct <= 100);

comment on column public.ai_picks.odds_data is
  'JSON array of { key, title, odds } sorted best-to-worst for the picked side';
comment on column public.ai_picks.confidence_pct is
  'Engie win-probability estimate 0-100';

-- ── Automated pick generation every 15 minutes via pg_cron ──────────────────
--
-- Prerequisites (one-time, in Supabase Dashboard → Database → Extensions):
--   1. Enable  pg_cron
--   2. Enable  pg_net
--   3. In Dashboard → Edge Functions → Secrets, add:
--        CRON_SECRET = <any long random string>
--
-- Then run the block below, replacing the two placeholders:
--
-- select cron.schedule(
--   'auto-generate-ai-picks',
--   '*/15 * * * *',
--   $$
--   select net.http_post(
--     url     := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/generate-ai-picks',
--     headers := jsonb_build_object(
--       'Content-Type',   'application/json',
--       'x-cron-secret',  '<YOUR_CRON_SECRET>'
--     ),
--     body    := '{}'::jsonb
--   );
--   $$
-- );
