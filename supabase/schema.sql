-- ============================================================
-- TradeOS — Schema completo
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- ACCOUNTS
-- ------------------------------------------------------------
create table if not exists accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users not null,
  name            text not null,
  broker          text,
  account_type    text check (account_type in ('real', 'funded', 'demo', 'paper')) default 'real',
  currency        text default 'USD',
  initial_balance numeric(12,2),
  active          boolean default true,
  color           text default '#3b82f6',
  notes           text,
  created_at      timestamptz default now(),
  unique(user_id, name)
);

alter table accounts enable row level security;

create policy "Users see own accounts" on accounts
  for all using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- STRATEGIES
-- ------------------------------------------------------------
create table if not exists strategies (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  name        text not null,
  description text,
  rules       text,
  active      boolean default true,
  created_at  timestamptz default now()
);

alter table strategies enable row level security;

create policy "Users see own strategies" on strategies
  for all using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- TRADES
-- ------------------------------------------------------------
create table if not exists trades (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users not null,
  account_id   uuid references accounts(id) on delete cascade not null,
  trade_number integer,
  instrument   text not null,
  direction    text check (direction in ('long', 'short')) not null,
  contracts    integer not null,
  entry_price  numeric(12,4) not null,
  exit_price   numeric(12,4) not null,
  entry_time   timestamptz not null,
  exit_time    timestamptz not null,
  pnl          numeric(10,2) not null,
  commission   numeric(8,2) default 0,
  net_pnl      numeric(10,2) not null,
  mae          numeric(10,2),
  mfe          numeric(10,2),
  stop_price   numeric(12,4),
  strategy_id  uuid references strategies(id) on delete set null,
  session      text check (session in ('RTH', 'ETH', 'overnight')),
  notes        text,
  tags         text[],
  created_at   timestamptz default now()
);

create unique index if not exists trades_no_duplicates
  on trades (account_id, trade_number);

alter table trades enable row level security;

create policy "Users see own trades" on trades
  for all using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- DAILY JOURNAL
-- ------------------------------------------------------------
create table if not exists daily_journal (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references auth.users not null,
  date               date not null,
  pre_market_notes   text,
  post_market_notes  text,
  mood               integer check (mood between 1 and 5),
  followed_plan      boolean,
  created_at         timestamptz default now(),
  unique(user_id, date)
);

alter table daily_journal enable row level security;

create policy "Users see own journal" on daily_journal
  for all using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- TRADE ATTACHMENTS (screenshots / charts per trade)
-- ------------------------------------------------------------
create table if not exists trade_attachments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users not null,
  trade_id     uuid references trades(id) on delete cascade not null,
  storage_path text not null,
  file_name    text not null,
  mime_type    text not null,
  size_bytes   bigint not null,
  created_at   timestamptz default now()
);

create index if not exists trade_attachments_trade_id_idx
  on trade_attachments (trade_id);

alter table trade_attachments enable row level security;

create policy "Users see own attachments" on trade_attachments
  for all using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- STORAGE — private bucket for trade attachments
-- Objects are stored under "{user_id}/{trade_id}/{file}", so RLS is
-- scoped to the first path segment. Public access is disabled; the app
-- serves images via short-lived signed URLs generated server-side.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('trade-attachments', 'trade-attachments', false)
on conflict (id) do nothing;

create policy "Users read own trade attachments"
  on storage.objects for select
  using (
    bucket_id = 'trade-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users upload own trade attachments"
  on storage.objects for insert
  with check (
    bucket_id = 'trade-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users delete own trade attachments"
  on storage.objects for delete
  using (
    bucket_id = 'trade-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
