-- gen_random_uuid() is built into PostgreSQL 13+ (pgcrypto core).
-- uuid-ossp is kept for any tooling that references it, but gen_random_uuid()
-- is NOT used here — gen_random_uuid() needs no extension and always works.

-- ─────────────────────────────────────────
-- PROFILES (extends auth.users)
-- ─────────────────────────────────────────
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  username       text unique not null,
  avatar_url     text,
  push_token     text,
  bankroll       numeric(12,2) not null default 1000,
  kelly_fraction numeric(4,3)  not null default 0.25,
  favorite_sports text[] default '{}',
  last_ai_request timestamptz,
  created_at     timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────
-- AI PICKS
-- ─────────────────────────────────────────
create table if not exists public.ai_picks (
  id               uuid primary key default gen_random_uuid(),
  game_id          text not null,
  sport            text not null,
  home_team        text not null,
  away_team        text not null,
  commence_time    timestamptz not null,
  selection        text not null,
  bet_type         text not null default 'moneyline',
  recommended_odds integer not null,
  bookmaker_key    text,
  value_rating     integer not null check (value_rating between 1 and 10),
  reasoning        text not null,
  model_version    text not null default 'claude-sonnet-4-6',
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default (now() + interval '12 hours')
);

create index if not exists ai_picks_expires_at_idx on public.ai_picks(expires_at);
create index if not exists ai_picks_value_rating_idx on public.ai_picks(value_rating desc);

-- ─────────────────────────────────────────
-- BETS
-- ─────────────────────────────────────────
create table if not exists public.bets (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  game_id           text not null,
  game_description  text not null,
  sport             text not null,
  bet_type          text not null,
  selection         text not null,
  bookmaker_key     text,
  odds              integer not null,
  stake             numeric(12,2) not null,
  potential_payout  numeric(12,2) not null,
  status            text not null default 'pending' check (status in ('pending','won','lost','push')),
  ai_pick_id        uuid references public.ai_picks(id) on delete set null,
  placed_at         timestamptz not null default now(),
  settled_at        timestamptz
);

create index if not exists bets_user_id_idx on public.bets(user_id);
create index if not exists bets_status_idx on public.bets(status);

-- ─────────────────────────────────────────
-- BANKROLL TRANSACTIONS
-- ─────────────────────────────────────────
create table if not exists public.bankroll_transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  type          text not null check (type in ('deposit','withdrawal','bet_win','bet_loss','push_refund')),
  amount        numeric(12,2) not null,
  balance_after numeric(12,2) not null,
  bet_id        uuid references public.bets(id) on delete set null,
  note          text,
  created_at    timestamptz not null default now()
);

create index if not exists bankroll_tx_user_idx on public.bankroll_transactions(user_id, created_at desc);

-- ─────────────────────────────────────────
-- COMMUNITY PICKS
-- ─────────────────────────────────────────
create table if not exists public.picks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  game_id       text not null,
  sport         text not null,
  matchup       text not null,
  selection     text not null,
  bet_type      text not null default 'moneyline',
  odds          integer not null,
  bookmaker_key text,
  note          text,
  result        text check (result in ('won','lost','push')),
  ai_pick_id    uuid references public.ai_picks(id) on delete set null,
  like_count    integer not null default 0,
  comment_count integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists picks_user_id_idx on public.picks(user_id);
create index if not exists picks_created_at_idx on public.picks(created_at desc);

-- ─────────────────────────────────────────
-- PICK LIKES
-- ─────────────────────────────────────────
create table if not exists public.pick_likes (
  pick_id    uuid not null references public.picks(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (pick_id, user_id)
);

-- Sync like_count on picks
create or replace function public.sync_like_count()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    update public.picks set like_count = like_count + 1 where id = new.pick_id;
  elsif TG_OP = 'DELETE' then
    update public.picks set like_count = greatest(like_count - 1, 0) where id = old.pick_id;
  end if;
  return null;
end;
$$;

drop trigger if exists sync_pick_likes on public.pick_likes;
create trigger sync_pick_likes
  after insert or delete on public.pick_likes
  for each row execute procedure public.sync_like_count();

-- ─────────────────────────────────────────
-- PICK COMMENTS
-- ─────────────────────────────────────────
create table if not exists public.pick_comments (
  id         uuid primary key default gen_random_uuid(),
  pick_id    uuid not null references public.picks(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists pick_comments_pick_id_idx on public.pick_comments(pick_id, created_at asc);

-- Sync comment_count on picks
create or replace function public.sync_comment_count()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    update public.picks set comment_count = comment_count + 1 where id = new.pick_id;
  elsif TG_OP = 'DELETE' then
    update public.picks set comment_count = greatest(comment_count - 1, 0) where id = old.pick_id;
  end if;
  return null;
end;
$$;

drop trigger if exists sync_pick_comments on public.pick_comments;
create trigger sync_pick_comments
  after insert or delete on public.pick_comments
  for each row execute procedure public.sync_comment_count();

-- ─────────────────────────────────────────
-- FOLLOWS
-- ─────────────────────────────────────────
create table if not exists public.follows (
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────
alter table public.profiles           enable row level security;
alter table public.ai_picks           enable row level security;
alter table public.bets               enable row level security;
alter table public.bankroll_transactions enable row level security;
alter table public.picks              enable row level security;
alter table public.pick_likes         enable row level security;
alter table public.pick_comments      enable row level security;
alter table public.follows            enable row level security;

-- profiles: public read, self write
create policy "profiles_public_read"  on public.profiles for select using (true);
create policy "profiles_self_insert"  on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_self_update"  on public.profiles for update using (auth.uid() = id);

-- ai_picks: public read (no writes from client)
create policy "ai_picks_public_read"  on public.ai_picks for select using (true);

-- bets: private to owner
create policy "bets_owner_all"        on public.bets for all using (auth.uid() = user_id);

-- bankroll_transactions: private to owner
create policy "bankroll_tx_owner_all" on public.bankroll_transactions for all using (auth.uid() = user_id);

-- picks: public read, authenticated insert/update/delete own
create policy "picks_public_read"     on public.picks for select using (true);
create policy "picks_auth_insert"     on public.picks for insert with check (auth.uid() = user_id);
create policy "picks_owner_update"    on public.picks for update using (auth.uid() = user_id);
create policy "picks_owner_delete"    on public.picks for delete using (auth.uid() = user_id);

-- pick_likes: public read, authenticated manage own
create policy "likes_public_read"     on public.pick_likes for select using (true);
create policy "likes_auth_insert"     on public.pick_likes for insert with check (auth.uid() = user_id);
create policy "likes_owner_delete"    on public.pick_likes for delete using (auth.uid() = user_id);

-- pick_comments: public read, authenticated manage own
create policy "comments_public_read"  on public.pick_comments for select using (true);
create policy "comments_auth_insert"  on public.pick_comments for insert with check (auth.uid() = user_id);
create policy "comments_owner_delete" on public.pick_comments for delete using (auth.uid() = user_id);

-- follows: public read, authenticated manage own
create policy "follows_public_read"   on public.follows for select using (true);
create policy "follows_auth_insert"   on public.follows for insert with check (auth.uid() = follower_id);
create policy "follows_owner_delete"  on public.follows for delete using (auth.uid() = follower_id);

-- Enable realtime for live comment updates
alter publication supabase_realtime add table public.pick_comments;
alter publication supabase_realtime add table public.picks;
