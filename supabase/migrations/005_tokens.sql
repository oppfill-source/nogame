-- ── Virtual token balance on profiles ──────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS token_balance INTEGER NOT NULL DEFAULT 1000;

-- ── Token transaction log ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS token_transactions (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type         TEXT        NOT NULL CHECK (type IN ('signup_bonus','bet_placed','bet_won','bet_lost','bet_push')),
  amount       INTEGER     NOT NULL,
  balance_after INTEGER    NOT NULL,
  bet_id       UUID        REFERENCES bets(id) ON DELETE SET NULL,
  note         TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own token_transactions"
  ON token_transactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Grant signup bonus to existing profiles (idempotent) ─────────────────────
-- Only inserts the bonus row if one doesn't already exist for that user
INSERT INTO token_transactions (user_id, type, amount, balance_after, note)
SELECT id, 'signup_bonus', 1000, 1000, 'Welcome bonus — practice tokens'
FROM profiles
WHERE id NOT IN (SELECT user_id FROM token_transactions WHERE type = 'signup_bonus');

-- ── Trigger: grant 1000 tokens when a new profile is created ─────────────────
CREATE OR REPLACE FUNCTION grant_signup_tokens()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO token_transactions (user_id, type, amount, balance_after, note)
  VALUES (NEW.id, 'signup_bonus', 1000, 1000, 'Welcome bonus — practice tokens');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_grant_tokens ON profiles;
CREATE TRIGGER on_profile_created_grant_tokens
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION grant_signup_tokens();
