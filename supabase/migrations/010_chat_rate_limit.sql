-- 010: rate-limit column for ai-picks-chat
alter table public.profiles
  add column if not exists last_chat_request timestamptz;
