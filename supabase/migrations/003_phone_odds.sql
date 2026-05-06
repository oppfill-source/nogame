-- Add phone verification and odds format preference to user profiles

alter table public.profiles
  add column if not exists phone_number   text,
  add column if not exists phone_verified boolean not null default false,
  add column if not exists odds_format    text    not null default 'american';

alter table public.profiles
  drop constraint if exists profiles_odds_format_check;

alter table public.profiles
  add constraint profiles_odds_format_check
    check (odds_format in ('american', 'decimal'));
