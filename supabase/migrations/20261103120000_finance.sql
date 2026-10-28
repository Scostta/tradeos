-- ============================================================
-- Módulo Money — gastos, ahorro y suscripciones (MONEY_SPEC.md §2).
--
-- Todo por usuario (RLS auth.uid() = user_id). Prefijo finance_*: no se
-- relaciona con las tablas de Trading (accounts, trades…) ni con invest_*.
--
--   finance_accounts        cuentas bancarias (y la cuenta "Cash" del efectivo)
--   finance_categories      categorías; kind decide el cálculo del ahorro
--   finance_transactions    movimientos importados o manuales; dedupe por
--                           (account_id, import_key); dividir = hijos con parent_id
--   finance_category_rules  reglas aprendidas: "contiene" sobre counterparty
--   finance_subscriptions   recurrentes detectadas tras cada import
--   finance_goals           objetivos: reparten sobre el papel el ahorro real
--   finance_settings        una fila por usuario; su alta crea Cash y el seed
--                           de categorías (server action, no SQL)
-- ============================================================

begin;

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
  category_id   uuid references finance_categories(id) on delete cascade not null,
  priority      integer not null default 0,
  created_from  uuid references finance_transactions(id) on delete set null,
  hits          integer not null default 0,
  created_at    timestamptz not null default now(),
  unique (user_id, pattern)
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

commit;
