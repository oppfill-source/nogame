-- ─────────────────────────────────────────────────────────────────────────────
-- 012: Add onboarded_at to track first-time setup completion.
-- NULL  = new user who has not yet seen the onboarding flow.
-- value = timestamp when the user completed onboarding.
-- All existing rows are stamped now so they silently skip the flow.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists onboarded_at timestamptz;

-- Mark every existing user as already onboarded so the overlay never
-- appears for users who signed up before this migration.
update public.profiles
  set onboarded_at = now()
  where onboarded_at is null;
