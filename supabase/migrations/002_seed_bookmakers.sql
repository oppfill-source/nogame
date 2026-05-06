-- Bookmakers reference table (for display/affiliate metadata)
create table if not exists public.bookmakers (
  key         text primary key,
  title       text not null,
  logo_url    text,
  bonus       text,
  rating      numeric(2,1) not null default 4.0,
  regions     text[] not null default '{"us"}',
  affiliate_url text,
  active      boolean not null default true
);

alter table public.bookmakers enable row level security;
create policy "bookmakers_public_read" on public.bookmakers for select using (true);

insert into public.bookmakers (key, title, bonus, rating, regions, affiliate_url) values
  ('draftkings',  'DraftKings',  'Bet $5, Get $200 in Bonus Bets',   4.8, '{"us"}',    'https://www.draftkings.com/r/sportsbook'),
  ('fanduel',     'FanDuel',     'Bet $5, Get $200 in Bonus Bets',   4.7, '{"us"}',    'https://www.fanduel.com/sportsbook'),
  ('betmgm',      'BetMGM',      'First Bet Offer up to $1,500',     4.5, '{"us"}',    'https://www.betmgm.com/en/sports'),
  ('caesars',     'Caesars',     'First Bet on Caesars up to $1,000', 4.4, '{"us"}',   'https://www.caesars.com/sportsbook'),
  ('bet365',      'bet365',      'Bet $1, Get $200 in Bonus Bets',   4.6, '{"gb","au","ca"}', 'https://www.bet365.com'),
  ('betrivers',   'BetRivers',   '2nd Chance Bet up to $500',        4.2, '{"us"}',    'https://www.betrivers.com'),
  ('pointsbet',   'PointsBet',   '5 x $50 Bonus Bets',               4.0, '{"us"}',    'https://www.pointsbet.com')
on conflict (key) do nothing;
