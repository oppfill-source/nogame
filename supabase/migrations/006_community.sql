-- ── Copy tracking on picks ────────────────────────────────────────────────────
ALTER TABLE picks ADD COLUMN IF NOT EXISTS copy_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS pick_copies (
  pick_id    UUID NOT NULL REFERENCES picks(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (pick_id, user_id)
);

ALTER TABLE pick_copies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copies_public_read"  ON pick_copies FOR SELECT USING (true);
CREATE POLICY "copies_auth_insert"  ON pick_copies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "copies_owner_delete" ON pick_copies FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION sync_copy_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE picks SET copy_count = copy_count + 1 WHERE id = NEW.pick_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE picks SET copy_count = GREATEST(copy_count - 1, 0) WHERE id = OLD.pick_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_pick_copies ON pick_copies;
CREATE TRIGGER sync_pick_copies
  AFTER INSERT OR DELETE ON pick_copies
  FOR EACH ROW EXECUTE FUNCTION sync_copy_count();

-- ── Comment upvotes ───────────────────────────────────────────────────────────
ALTER TABLE pick_comments ADD COLUMN IF NOT EXISTS upvote_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS comment_upvotes (
  comment_id UUID NOT NULL REFERENCES pick_comments(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comment_id, user_id)
);

ALTER TABLE comment_upvotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cup_public_read"  ON comment_upvotes FOR SELECT USING (true);
CREATE POLICY "cup_auth_insert"  ON comment_upvotes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cup_owner_delete" ON comment_upvotes FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION sync_upvote_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE pick_comments SET upvote_count = upvote_count + 1 WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE pick_comments SET upvote_count = GREATEST(upvote_count - 1, 0) WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_comment_upvotes ON comment_upvotes;
CREATE TRIGGER sync_comment_upvotes
  AFTER INSERT OR DELETE ON comment_upvotes
  FOR EACH ROW EXECUTE FUNCTION sync_upvote_count();

-- ── Follower counts on profiles ───────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS follower_count  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS following_count INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION sync_follow_counts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET follower_count  = follower_count  + 1 WHERE id = NEW.following_id;
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET follower_count  = GREATEST(follower_count  - 1, 0) WHERE id = OLD.following_id;
    UPDATE profiles SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_follows ON follows;
CREATE TRIGGER sync_follows
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION sync_follow_counts();

-- ── Notifications ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL CHECK (type IN ('new_follower','pick_comment','pick_liked','pick_copied')),
  actor_id   UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  pick_id    UUID        REFERENCES picks(id) ON DELETE CASCADE,
  read       BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notif_user_idx ON notifications(user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_owner_all" ON notifications FOR ALL USING (auth.uid() = user_id);

-- Trigger: notify pick owner when someone comments
CREATE OR REPLACE FUNCTION notify_on_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE pick_owner UUID;
BEGIN
  SELECT user_id INTO pick_owner FROM picks WHERE id = NEW.pick_id;
  IF pick_owner IS NOT NULL AND pick_owner <> NEW.user_id THEN
    INSERT INTO notifications (user_id, type, actor_id, pick_id)
    VALUES (pick_owner, 'pick_comment', NEW.user_id, NEW.pick_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_pick_comment ON pick_comments;
CREATE TRIGGER on_pick_comment
  AFTER INSERT ON pick_comments
  FOR EACH ROW EXECUTE FUNCTION notify_on_comment();

-- Trigger: notify pick owner on like
CREATE OR REPLACE FUNCTION notify_on_like()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE pick_owner UUID;
BEGIN
  SELECT user_id INTO pick_owner FROM picks WHERE id = NEW.pick_id;
  IF pick_owner IS NOT NULL AND pick_owner <> NEW.user_id THEN
    INSERT INTO notifications (user_id, type, actor_id, pick_id)
    VALUES (pick_owner, 'pick_liked', NEW.user_id, NEW.pick_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_pick_like ON pick_likes;
CREATE TRIGGER on_pick_like
  AFTER INSERT ON pick_likes
  FOR EACH ROW EXECUTE FUNCTION notify_on_like();

-- Trigger: notify user on new follower
CREATE OR REPLACE FUNCTION notify_on_follow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, actor_id)
  VALUES (NEW.following_id, 'new_follower', NEW.follower_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_follow ON follows;
CREATE TRIGGER on_new_follow
  AFTER INSERT ON follows
  FOR EACH ROW EXECUTE FUNCTION notify_on_follow();

-- ── Leaderboard RPC ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_leaderboard(period TEXT DEFAULT 'all')
RETURNS TABLE (
  user_id        UUID,
  username       TEXT,
  avatar_url     TEXT,
  follower_count INTEGER,
  total_picks    BIGINT,
  won_picks      BIGINT,
  lost_picks     BIGINT,
  win_rate       NUMERIC,
  trust_score    NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  cutoff TIMESTAMPTZ;
BEGIN
  cutoff := CASE period
    WHEN 'week'  THEN NOW() - INTERVAL '7 days'
    WHEN 'month' THEN NOW() - INTERVAL '30 days'
    ELSE '1970-01-01'::TIMESTAMPTZ
  END;

  RETURN QUERY
    SELECT
      p.id,
      p.username,
      p.avatar_url,
      p.follower_count,
      COUNT(pk.id)                                                     AS total_picks,
      SUM(CASE WHEN pk.result = 'won'  THEN 1 ELSE 0 END)             AS won_picks,
      SUM(CASE WHEN pk.result = 'lost' THEN 1 ELSE 0 END)             AS lost_picks,
      CASE
        WHEN SUM(CASE WHEN pk.result IN ('won','lost') THEN 1 ELSE 0 END) = 0 THEN 0
        ELSE ROUND(
          SUM(CASE WHEN pk.result = 'won' THEN 1 ELSE 0 END)::NUMERIC /
          SUM(CASE WHEN pk.result IN ('won','lost') THEN 1 ELSE 0 END) * 100,
          1
        )
      END AS win_rate,
      CASE
        WHEN SUM(CASE WHEN pk.result IN ('won','lost') THEN 1 ELSE 0 END) = 0 THEN 0
        ELSE ROUND(
          SUM(CASE WHEN pk.result = 'won' THEN 1 ELSE 0 END)::NUMERIC /
          SUM(CASE WHEN pk.result IN ('won','lost') THEN 1 ELSE 0 END) * 100,
          1
        )
      END AS trust_score
    FROM profiles p
    INNER JOIN picks pk ON pk.user_id = p.id AND pk.created_at >= cutoff
    WHERE pk.result IS NOT NULL
    GROUP BY p.id, p.username, p.avatar_url, p.follower_count
    HAVING COUNT(pk.id) >= 1
    ORDER BY win_rate DESC, total_picks DESC
    LIMIT 50;
END;
$$;
