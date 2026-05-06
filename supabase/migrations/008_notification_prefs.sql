-- ── Notification preferences ─────────────────────────────────────────────────
-- Stored directly on profiles so a single row fetch gives everything.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notif_engie_picks    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_community      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_bet_settlement BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_leaderboard    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_follows        BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_daily_digest   BOOLEAN NOT NULL DEFAULT true;

-- ── Daily digest cron (requires pg_cron extension — enable in Supabase Dashboard) ──
-- Uncomment once pg_cron is enabled on your project:
-- SELECT cron.schedule('digest-morning', '0 13 * * *',   -- 8am EST = 13:00 UTC
--   $$ SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='SUPABASE_URL') || '/functions/v1/send-notifications', headers := '{"Content-Type":"application/json","Authorization":"Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='SUPABASE_SERVICE_ROLE_KEY') || '"}'::jsonb, body := '{"type":"daily_digest"}'::jsonb) $$
-- );
-- SELECT cron.schedule('digest-evening', '0 23 * * *',   -- 6pm EST = 23:00 UTC
--   $$ SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='SUPABASE_URL') || '/functions/v1/send-notifications', headers := '{"Content-Type":"application/json","Authorization":"Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='SUPABASE_SERVICE_ROLE_KEY') || '"}'::jsonb, body := '{"type":"daily_digest"}'::jsonb) $$
-- );
