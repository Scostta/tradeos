-- ============================================================
-- Módulo Invest — núcleo/satélite con screener mensual (INVEST_SPEC.md §2).
--
-- Datos compartidos (no por usuario), escritos solo por el job de
-- scripts/screener con la service role; los usuarios autenticados solo leen:
--   - invest_screen_runs     un run por cierre mensual evaluado
--   - invest_screen_results  todos los tickers evaluados en cada run (pasen o no)
--   - invest_prices          cierres mensuales ajustados (benchmark + tickers
--                            con alguna posición)
--   - invest_position_checks señal hold/sell mensual por posición abierta
--                            (lectura limitada al dueño de la posición)
--
-- Datos por usuario (RLS auth.uid() = user_id):
--   - invest_positions       posiciones del satélite, con tesis y falsadores
--   - invest_settings        una fila por usuario
--
-- Un rerun del job para el mismo run_date reutiliza la fila del run (mismo id)
-- y rehace results/checks: invest_positions.run_id no tiene on delete cascade
-- y un DELETE del run fallaría si alguna posición salió de él.
--
-- Las reglas del screener viven solo en evaluate() del job (Python); la app
-- no las reimplementa.
-- Rollback: supabase/rollbacks/20261027120000_invest_down.sql
-- ============================================================

create table if not exists invest_screen_runs (
  id             uuid primary key default gen_random_uuid(),
  run_date       date not null unique,       -- cierre mensual evaluado (último día hábil del mes anterior)
  executed_at    timestamptz default now(),
  universe_size  integer not null,
  passed_count   integer not null,
  benchmark      text not null,               -- ticker usado (IWDA.AS)
  job_version    text not null                -- git sha del job
);

alter table invest_screen_runs enable row level security;

drop policy if exists "Authenticated read screen runs" on invest_screen_runs;
create policy "Authenticated read screen runs" on invest_screen_runs
  for select to authenticated using (true);

create table if not exists invest_screen_results (
  id                  uuid primary key default gen_random_uuid(),
  run_id              uuid references invest_screen_runs(id) on delete cascade not null,
  ticker              text not null,
  name                text,
  exchange            text,
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
  passes              boolean not null,       -- fundamental and technical and months_listed >= 12 and market_cap > 2e9
  fail_reasons        text[] not null default '{}',
  unique (run_id, ticker)
);

create index if not exists invest_screen_results_run_passes_idx
  on invest_screen_results (run_id, passes);

alter table invest_screen_results enable row level security;

drop policy if exists "Authenticated read screen results" on invest_screen_results;
create policy "Authenticated read screen results" on invest_screen_results
  for select to authenticated using (true);

create table if not exists invest_positions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users on delete cascade not null,
  ticker        text not null,
  run_id        uuid references invest_screen_runs(id) not null,  -- run que lo aprobó
  opened_at     date not null,
  entry_price   numeric(12,4) not null,
  shares        numeric(14,4) not null,
  fees_open     numeric(10,2) default 0,
  thesis        text not null,
  falsifiers    text[] not null,
  closed_at     date,
  exit_price    numeric(12,4),
  fees_close    numeric(10,2) default 0,
  exit_reason   text check (exit_reason in ('sma_exit','falsifier','manual')),
  exit_note     text,                         -- qué falsador saltó / motivo manual
  created_at    timestamptz default now(),
  constraint invest_positions_falsifiers_min check (array_length(falsifiers, 1) >= 2),
  constraint invest_positions_close_consistent check (
    (closed_at is null and exit_price is null and exit_reason is null)
    or (closed_at is not null and exit_price is not null and exit_reason is not null)
  )
);

-- Nunca se promedia a la baja: una sola posición abierta por ticker.
create unique index if not exists invest_positions_one_open_per_ticker
  on invest_positions (user_id, ticker) where closed_at is null;

alter table invest_positions enable row level security;

drop policy if exists "Users manage own invest positions" on invest_positions;
create policy "Users manage own invest positions" on invest_positions
  for all using (auth.uid() = user_id);

create table if not exists invest_settings (
  user_id               uuid primary key references auth.users on delete cascade,
  total_portfolio_value numeric(14,2) not null,   -- núcleo + satélite, lo actualiza el usuario
  satellite_pct         numeric(5,4) not null default 0.20,
  max_positions         integer not null default 5,
  position_pct          numeric(5,4) not null default 0.04,
  benchmark_ticker      text not null default 'IWDA.AS',
  started_at            date not null default current_date,
  -- Último run que el usuario revisó en la pestaña Screen (§4.6).
  last_reviewed_run_id  uuid references invest_screen_runs(id) on delete set null,
  updated_at            timestamptz default now()
);

alter table invest_settings enable row level security;

drop policy if exists "Users manage own invest settings" on invest_settings;
create policy "Users manage own invest settings" on invest_settings
  for all using (auth.uid() = user_id);

create table if not exists invest_prices (
  ticker     text not null,
  month_end  date not null,                  -- último día hábil del mes (mismo calendario que run_date)
  adj_close  numeric(12,4) not null,
  primary key (ticker, month_end)
);

alter table invest_prices enable row level security;

drop policy if exists "Authenticated read invest prices" on invest_prices;
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

drop policy if exists "Users read own position checks" on invest_position_checks;
create policy "Users read own position checks" on invest_position_checks
  for select using (
    exists (
      select 1 from invest_positions p
      where p.id = position_id and p.user_id = auth.uid()
    )
  );
