-- ─────────────────────────────────────────────────────────────────────────────
-- 009: AI Picks Bet365-edge fields
-- Adds the columns the new generate-ai-picks Edge Function fills in.
-- All columns nullable so old rows continue to work.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.ai_picks
  add column if not exists league            text,
  add column if not exists market            text,
  add column if not exists risk_level        text,
  add column if not exists key_factors       jsonb,
  add column if not exists stake_level       text,
  add column if not exists warning           text,
  add column if not exists bet365_odds       integer,
  add column if not exists avg_market_odds   numeric(8,3),
  add column if not exists edge_pct          numeric(8,3),
  add column if not exists implied_prob_diff numeric(8,4),
  add column if not exists prompt_params     jsonb;
