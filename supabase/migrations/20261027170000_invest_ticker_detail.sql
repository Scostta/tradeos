-- ============================================================
-- Módulo Invest — página de detalle /invest/[ticker] (INVEST_SPEC.md §4.7).
--
-- Ayuda a escribir tesis y falsadores; no decide nada (las reglas siguen solo
-- en evaluate() del job).
--
--   invest_tickers              ficha por ticker (nombre, sector, industria,
--                               resumen del negocio, divisas). Job, upsert.
--   invest_fundamentals_history últimos 4 años fiscales por ticker. Job, upsert.
--   invest_thesis_drafts        respuestas del bloque "Thesis prompts" por
--                               usuario y ticker (RLS por usuario).
--
-- Las dos primeras son compartidas: select para authenticated, escritura solo
-- con la service role (sin políticas de escritura).
-- ============================================================

begin;

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
drop policy if exists "Authenticated read invest tickers" on invest_tickers;
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
drop policy if exists "Authenticated read invest fundamentals history" on invest_fundamentals_history;
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
drop policy if exists "Users manage own thesis drafts" on invest_thesis_drafts;
create policy "Users manage own thesis drafts" on invest_thesis_drafts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

commit;
