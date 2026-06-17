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
  -- Prop-firm rules (nullable; null = no regla)
  prop_phase        text check (prop_phase in ('evaluation', 'funded', 'payout')),
  drawdown_type     text check (drawdown_type in ('trailing_intraday', 'trailing_eod', 'static')),
  drawdown_amount   numeric(12,2),
  drawdown_lock_at  numeric(12,2),
  daily_loss_limit  numeric(12,2),
  profit_target     numeric(12,2),
  min_trading_days  integer,
  risk_per_trade    numeric(12,2),   -- $ arriesgado por trade (fallback de R cuando no hay stop)
  created_at      timestamptz default now(),
  unique(user_id, name)
);

alter table accounts enable row level security;

create policy "Users see own accounts" on accounts
  for all using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- PLAYBOOKS
-- ------------------------------------------------------------
create table if not exists playbooks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  name        text not null,
  description text,
  rules       text,
  active      boolean default true,
  created_at  timestamptz default now()
);

alter table playbooks enable row level security;

create policy "Users see own playbooks" on playbooks
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
  playbook_id  uuid references playbooks(id) on delete set null,
  session      text check (session in ('RTH', 'ETH', 'overnight')),
  notes        text,
  tags         text[],
  source       text not null default 'import',  -- 'import' | 'manual'
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
-- USER GOALS (metas mensuales: una global + una por cuenta)
-- account_id null = meta global (todas las cuentas)
-- ------------------------------------------------------------
create table if not exists user_goals (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references auth.users not null,
  account_id         uuid references accounts(id) on delete cascade,
  monthly_pnl_target numeric(12,2),
  win_rate_target    numeric(5,4),    -- 0..1
  max_drawdown_limit numeric(12,2),   -- máximo drawdown permitido (positivo)
  min_trading_days   integer,
  updated_at         timestamptz default now()
);

-- Una meta global por usuario, una por (usuario, cuenta)
create unique index if not exists user_goals_global_uniq
  on user_goals (user_id) where account_id is null;
create unique index if not exists user_goals_account_uniq
  on user_goals (user_id, account_id) where account_id is not null;

alter table user_goals enable row level security;

create policy "Users manage own goals" on user_goals
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
on conflict (id) do update set public = false;

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

-- ------------------------------------------------------------
-- AI INSIGHTS — análisis generados por Claude, cacheados por hash del input.
-- Una fila por scope (global = account_id null, o por cuenta). Solo se regenera
-- cuando input_hash deja de coincidir con los datos actuales (control de coste).
-- ------------------------------------------------------------
create table if not exists ai_insights (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users not null,
  account_id   uuid references accounts(id) on delete cascade,  -- null = todas las cuentas
  input_hash   text not null,
  insights     jsonb not null,
  model        text not null,
  trades_count integer not null,
  generated_at timestamptz default now()
);

create unique index if not exists ai_insights_global_uniq
  on ai_insights (user_id) where account_id is null;
create unique index if not exists ai_insights_account_uniq
  on ai_insights (user_id, account_id) where account_id is not null;

alter table ai_insights enable row level security;

create policy "Users manage own insights" on ai_insights
  for all using (auth.uid() = user_id);
