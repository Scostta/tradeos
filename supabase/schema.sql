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
  trade_number integer,                         -- solo display: NinjaTrader lo reinicia en cada export
  import_key   text,                            -- dedupe del import (helpers/trade-fingerprint.ts); null en manuales
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
  source       text not null default 'import',  -- 'import' | 'manual' | 'sync' (add-on NT8)
  created_at   timestamptz default now()
);

create unique index if not exists trades_import_key_unique
  on trades (account_id, import_key);

alter table trades enable row level security;

create policy "Users see own trades" on trades
  for all using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- IMPORT EXCLUSIONS
-- Trades del CSV que el usuario descarta a mano en el preview del import
-- (scratches / BE que ensucian metricas). El import los salta, asi un
-- re-import del mismo fichero no los vuelve a insertar.
-- ------------------------------------------------------------
create table if not exists import_exclusions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users on delete cascade not null,
  account_id   uuid references accounts(id) on delete cascade not null,
  trade_number integer,
  import_key   text not null,
  created_at   timestamptz default now(),
  unique (account_id, import_key)
);

create index if not exists import_exclusions_user_idx
  on import_exclusions (user_id);

alter table import_exclusions enable row level security;

create policy "Users manage own import exclusions" on import_exclusions
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

-- ------------------------------------------------------------
-- PROFILES — perfil de usuario (1:1 con auth.users). Preferencias:
-- display_name, timezone (IANA, solo persistida por ahora) y divisa por
-- defecto. Sin trigger: defaults on read + upsert on write.
-- ------------------------------------------------------------
create table if not exists profiles (
  user_id          uuid primary key references auth.users on delete cascade,
  display_name     text,
  timezone         text not null default 'UTC',
  default_currency text not null default 'USD',
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

alter table profiles enable row level security;

create policy "Users manage own profile" on profiles
  for all using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- REPORT SHARES — snapshot público read-only del resumen de reports.
-- Token aleatorio en la URL; la lectura pública va por service role filtrando
-- por (token, revoked=false) y solo expone `snapshot` (sin trades ni notas).
-- ------------------------------------------------------------
create table if not exists report_shares (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users on delete cascade not null,
  token       text unique not null,
  account_id  uuid references accounts(id) on delete cascade,  -- null = todas las cuentas
  range       text not null,
  title       text not null,
  snapshot    jsonb not null,
  revoked     boolean default false,
  created_at  timestamptz default now()
);

create index if not exists report_shares_token_idx on report_shares (token);

alter table report_shares enable row level security;

create policy "Users manage own shares" on report_shares
  for all using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- API TOKENS — auth del add-on de NinjaTrader 8 (POST /api/ingest/ninjatrader).
-- Solo se guarda el sha256; el token en claro se muestra una vez al crearlo.
-- La ruta de ingest lo resuelve con service role y escribe con su user_id.
-- ------------------------------------------------------------
create table if not exists api_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users on delete cascade not null,
  name          text not null,
  token_hash    text unique not null,
  token_prefix  text not null,
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz default now()
);

create index if not exists api_tokens_user_id_idx on api_tokens (user_id);

alter table api_tokens enable row level security;

create policy "Users manage own api tokens" on api_tokens
  for all using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- INVEST — núcleo/satélite con screener mensual (INVEST_SPEC.md).
-- runs / results / prices son compartidos: solo los escribe el job de
-- scripts/screener con service role; los usuarios autenticados solo leen.
-- Un rerun del mismo run_date reutiliza la fila del run (positions.run_id no
-- tiene cascade). Las reglas viven solo en evaluate() del job.
-- ------------------------------------------------------------
create table if not exists invest_screen_runs (
  id             uuid primary key default gen_random_uuid(),
  run_date       date not null unique,       -- cierre mensual evaluado
  executed_at    timestamptz default now(),
  universe_size  integer not null,
  passed_count   integer not null,
  benchmark      text not null,
  job_version    text not null                -- git sha del job
);

alter table invest_screen_runs enable row level security;

create policy "Authenticated read screen runs" on invest_screen_runs
  for select to authenticated using (true);

create table if not exists invest_screen_results (
  id                  uuid primary key default gen_random_uuid(),
  run_id              uuid references invest_screen_runs(id) on delete cascade not null,
  ticker              text not null,
  name                text,
  exchange            text,
  sector              text,                   -- info.sector (§1.4: máx. 2 abiertas por sector)
  currency            text,                   -- divisa de price (la app la pasa a EUR)
  market_cap          numeric(16,0),          -- en USD
  revenue_growth_yoy  numeric(8,4),
  fcf_margin          numeric(8,4),
  gross_margin        numeric(8,4),
  gross_margin_prev   numeric(8,4),
  net_debt_ebitda     numeric(8,4),
  roic                numeric(8,4),
  price               numeric(12,4),
  sma10m              numeric(12,4),
  momentum_12_1       numeric(8,4),
  rel_strength_6m     numeric(8,4),
  months_listed       integer,
  passes_fundamental  boolean not null,
  passes_technical    boolean not null,
  passes              boolean not null,
  fail_reasons        text[] not null default '{}',
  unique (run_id, ticker)
);

create index if not exists invest_screen_results_run_passes_idx
  on invest_screen_results (run_id, passes);

alter table invest_screen_results enable row level security;

create policy "Authenticated read screen results" on invest_screen_results
  for select to authenticated using (true);

create table if not exists invest_positions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users on delete cascade not null,
  ticker        text not null,
  run_id        uuid references invest_screen_runs(id) not null,
  opened_at     date not null,
  entry_price   numeric(12,4) not null,
  shares        numeric(14,4) not null,
  fees_open     numeric(10,2) default 0,
  thesis        text not null,
  falsifiers    text[] not null,
  falsifier_status jsonb not null default '[]'::jsonb,  -- "ok" | "review" por índice de falsifiers (§4.3)
  closed_at     date,
  exit_price    numeric(12,4),
  fees_close    numeric(10,2) default 0,
  exit_reason   text check (exit_reason in ('sma_exit','falsifier','manual')),
  exit_note     text,
  paper         boolean not null default false,  -- posición de papel (§1.6)
  created_at    timestamptz default now(),
  constraint invest_positions_falsifiers_min check (array_length(falsifiers, 1) >= 2),
  constraint invest_positions_falsifier_status_array check (jsonb_typeof(falsifier_status) = 'array'),
  constraint invest_positions_close_consistent check (
    (closed_at is null and exit_price is null and exit_reason is null)
    or (closed_at is not null and exit_price is not null and exit_reason is not null)
  )
);

-- Papel y real no se bloquean entre sí (§1.6).
create unique index if not exists invest_positions_one_open_per_ticker
  on invest_positions (user_id, ticker, paper) where closed_at is null;

alter table invest_positions enable row level security;

create policy "Users manage own invest positions" on invest_positions
  for all using (auth.uid() = user_id);

create table if not exists invest_settings (
  user_id               uuid primary key references auth.users on delete cascade,
  total_portfolio_value numeric(14,2) not null,
  satellite_pct         numeric(5,4) not null default 0.20,
  max_positions         integer not null default 5,
  position_pct          numeric(5,4) not null default 0.04,
  benchmark_ticker      text not null default 'IWDA.AS',
  started_at            date,                     -- lo fija la primera posición real (§1.6)
  paper_mode            boolean not null default true,  -- hasta "Start real test"
  updated_at            timestamptz default now()
);

alter table invest_settings enable row level security;

create policy "Users manage own invest settings" on invest_settings
  for all using (auth.uid() = user_id);

-- Una fila por usuario y run revisado (visita a Screen con el run vigente).
create table if not exists invest_reviews (
  user_id      uuid references auth.users on delete cascade not null,
  run_id       uuid references invest_screen_runs(id) on delete cascade not null,
  reviewed_at  timestamptz not null default now(),
  primary key (user_id, run_id)
);

alter table invest_reviews enable row level security;

create policy "Users manage own invest reviews" on invest_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Benchmarks, tickers con alguna posición y pares FX EUR{divisa}=X (unidades por 1 EUR).
create table if not exists invest_prices (
  ticker     text not null,
  month_end  date not null,
  adj_close  numeric(12,4) not null,
  close      numeric(12,4),           -- sin ajustar por dividendos (§5.1)
  primary key (ticker, month_end)
);

alter table invest_prices enable row level security;

create policy "Authenticated read invest prices" on invest_prices
  for select to authenticated using (true);

create table if not exists invest_position_checks (
  position_id  uuid references invest_positions(id) on delete cascade not null,
  run_id       uuid references invest_screen_runs(id) on delete cascade not null,
  price        numeric(12,4) not null,
  sma10m       numeric(12,4) not null,
  signal       text not null check (signal in ('hold','sell')),
  primary key (position_id, run_id)
);

alter table invest_position_checks enable row level security;

create policy "Users read own position checks" on invest_position_checks
  for select using (
    exists (
      select 1 from invest_positions p
      where p.id = position_id and p.user_id = auth.uid()
    )
  );

-- Página de detalle /invest/[ticker] (INVEST_SPEC.md §4.7).
create table if not exists invest_tickers (
  ticker              text primary key,
  name                text,
  exchange            text,
  currency            text,            -- divisa de cotización
  financial_currency  text,            -- divisa de los estados financieros
  sector              text,
  industry            text,
  summary             text,            -- info.longBusinessSummary
  updated_at          timestamptz not null default now()
);

alter table invest_tickers enable row level security;

create policy "Authenticated read invest tickers" on invest_tickers
  for select to authenticated using (true);

create table if not exists invest_fundamentals_history (
  ticker           text not null,
  fiscal_year      integer not null,
  revenue          numeric(20,0),     -- financial_currency
  gross_margin     numeric(8,4),
  fcf              numeric(20,0),     -- financial_currency
  roic             numeric(8,4),
  net_debt_ebitda  numeric(8,4),
  primary key (ticker, fiscal_year)
);

alter table invest_fundamentals_history enable row level security;

create policy "Authenticated read invest fundamentals history" on invest_fundamentals_history
  for select to authenticated using (true);

create table if not exists invest_thesis_drafts (
  user_id     uuid references auth.users on delete cascade not null,
  ticker      text not null,
  answers     jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (user_id, ticker)
);

alter table invest_thesis_drafts enable row level security;

create policy "Users manage own thesis drafts" on invest_thesis_drafts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- Money (MONEY_SPEC.md §2) — migración 20261103120000_finance.sql
-- ============================================================

-- 2.1 ─────────────────────────────────────────────────────────
create table if not exists finance_accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users on delete cascade not null,
  name        text not null,
  kind        text not null check (kind in ('checking','savings','broker','cash')),
  currency    text not null default 'EUR',
  iban_last4  text check (iban_last4 is null or iban_last4 ~ '^[0-9]{4}$'),  -- nunca el IBAN completo
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

-- 2.2 ─────────────────────────────────────────────────────────
create table if not exists finance_categories (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid references auth.users on delete cascade not null,
  name      text not null,
  kind      text not null check (kind in ('expense','income','transfer','savings')),
  is_fixed  boolean not null default false,
  color     text not null default '#64748b',
  sort      integer not null default 0,
  archived  boolean not null default false,
  unique (user_id, name)
);

-- 2.3 ─────────────────────────────────────────────────────────
create table if not exists finance_transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users on delete cascade not null,
  account_id      uuid references finance_accounts(id) on delete cascade not null,
  booked_at       date not null,
  amount          numeric(12,2) not null,           -- negativo = sale
  currency        text not null default 'EUR',
  concept_raw     text not null,
  counterparty    text,                             -- normalizeConcept()
  balance_after   numeric(12,2),
  category_id     uuid references finance_categories(id) on delete set null,
  category_source text check (category_source in ('rule','manual','split')),
  excluded        boolean not null default false,
  parent_id       uuid references finance_transactions(id) on delete cascade,
  notes           text,
  source          text not null default 'import' check (source in ('import','manual')),
  import_key      text not null,
  created_at      timestamptz not null default now(),
  unique (account_id, import_key),
  -- Las partes de un movimiento dividido las crea la app (§2.3).
  constraint finance_transactions_split_manual check (parent_id is null or source = 'manual')
);

create index if not exists finance_transactions_user_booked
  on finance_transactions (user_id, booked_at desc);
create index if not exists finance_transactions_user_category
  on finance_transactions (user_id, category_id);
create index if not exists finance_transactions_uncategorized
  on finance_transactions (user_id)
  where category_id is null and parent_id is null and not excluded;
create index if not exists finance_transactions_parent
  on finance_transactions (parent_id) where parent_id is not null;

-- 2.4 ─────────────────────────────────────────────────────────
create table if not exists finance_category_rules (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users on delete cascade not null,
  pattern       text not null,                      -- normalizado; match por "contiene"
  amount        numeric(12,2) check (amount is null or amount > 0),  -- importe absoluto exacto; null = cualquiera
  category_id   uuid references finance_categories(id) on delete cascade not null,
  priority      integer not null default 0,
  created_from  uuid references finance_transactions(id) on delete set null,
  hits          integer not null default 0,
  created_at    timestamptz not null default now(),
  constraint finance_category_rules_user_id_pattern_amount_key unique nulls not distinct (user_id, pattern, amount)
);

-- 2.5 ─────────────────────────────────────────────────────────
create table if not exists finance_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users on delete cascade not null,
  counterparty  text not null,
  amount        numeric(12,2) not null,             -- mediana de los 3 últimos cargos
  cadence       text not null check (cadence in ('weekly','monthly','quarterly','yearly')),
  category_id   uuid references finance_categories(id) on delete set null,
  first_seen    date not null,
  last_seen     date not null,
  next_expected date,
  occurrences   integer not null,
  status        text not null default 'pending' check (status in ('pending','confirmed','cancelled','ignored')),
  usage         text not null default 'unknown' check (usage in ('unknown','used','unused','fixed')),
  unused_since  date,
  notes         text check (char_length(notes) <= 500),   -- nota libre del usuario
  updated_at    timestamptz not null default now(),
  unique (user_id, counterparty, cadence)
);

-- 2.6 ─────────────────────────────────────────────────────────
create table if not exists finance_goals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users on delete cascade not null,
  name            text not null,
  target_amount   numeric(12,2) not null check (target_amount > 0),
  saved_amount    numeric(12,2) not null default 0 check (saved_amount >= 0),
  monthly_alloc   numeric(12,2) not null default 0 check (monthly_alloc >= 0),
  priority        integer not null default 1 check (priority >= 1),
  deadline        date,
  status          text not null default 'active' check (status in ('active','completed','archived')),
  created_at      timestamptz not null default now()
);

-- 2.7 ─────────────────────────────────────────────────────────
create table if not exists finance_settings (
  user_id          uuid primary key references auth.users on delete cascade,
  month_start_day  integer not null default 1 check (month_start_day between 1 and 28),
  default_account  uuid references finance_accounts(id) on delete set null,
  created_at       timestamptz not null default now()
);

-- RLS ─────────────────────────────────────────────────────────
alter table finance_accounts       enable row level security;
alter table finance_categories     enable row level security;
alter table finance_transactions   enable row level security;
alter table finance_category_rules enable row level security;
alter table finance_subscriptions  enable row level security;
alter table finance_goals          enable row level security;
alter table finance_settings       enable row level security;

drop policy if exists "Users manage own finance accounts" on finance_accounts;
create policy "Users manage own finance accounts" on finance_accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own finance categories" on finance_categories;
create policy "Users manage own finance categories" on finance_categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own finance transactions" on finance_transactions;
create policy "Users manage own finance transactions" on finance_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own finance rules" on finance_category_rules;
create policy "Users manage own finance rules" on finance_category_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own finance subscriptions" on finance_subscriptions;
create policy "Users manage own finance subscriptions" on finance_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own finance goals" on finance_goals;
create policy "Users manage own finance goals" on finance_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own finance settings" on finance_settings;
create policy "Users manage own finance settings" on finance_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
