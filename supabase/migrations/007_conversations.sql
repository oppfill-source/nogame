-- ── Conversation history ─────────────────────────────────────────────────────
-- One row per user — stores their running Engie chat as JSONB.
-- The edge function upserts after every response so history survives app restarts.
CREATE TABLE IF NOT EXISTS conversations (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  messages      JSONB       NOT NULL DEFAULT '[]',
  message_count INTEGER     NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "convs_owner_all" ON conversations
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS convs_user_idx ON conversations(user_id);

-- ── User betting personality & pattern cache ──────────────────────────────────
-- Refreshed by the edge function at the start of every session.
CREATE TABLE IF NOT EXISTS user_patterns (
  user_id               UUID    PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  -- Personality type (drives Engie's tone)
  personality           TEXT    NOT NULL DEFAULT 'balanced'
                        CHECK (personality IN ('conservative','aggressive','chaser','data_driven','balanced')),
  -- Aggregate stats (refreshed each call)
  total_settled         INTEGER NOT NULL DEFAULT 0,
  win_rate_overall      NUMERIC(5,2),
  roi_overall           NUMERIC(8,2),
  -- Best / worst performers
  best_sport            TEXT,
  best_bet_type         TEXT,
  worst_sport           TEXT,
  worst_team            TEXT,
  -- Streak & chasing signals
  current_streak        INTEGER NOT NULL DEFAULT 0,  -- positive = win streak, negative = loss streak
  loss_chasing_flags    INTEGER NOT NULL DEFAULT 0,
  stake_escalation_flags INTEGER NOT NULL DEFAULT 0,
  -- Free-text summary Engie can quote verbatim
  style_summary         TEXT,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patterns_owner_all" ON user_patterns
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
