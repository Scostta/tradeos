-- ============================================================
-- Reportes compartidos públicamente (snapshot read-only).
-- Cada fila es una "foto" congelada del resumen de rendimiento de una cuenta y
-- periodo (KPIs + equity + breakdowns agregados) accesible vía un token público
-- sin login. La lectura pública NO usa RLS: va por el service-role client
-- filtrando por (token, revoked=false) y solo expone la columna `snapshot`.
-- ============================================================
create table if not exists report_shares (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users on delete cascade not null,
  token       text unique not null,        -- token aleatorio inguesable de la URL
  account_id  uuid references accounts(id) on delete cascade,  -- null = todas las cuentas
  range       text not null,               -- TradesRange al crear (informativo)
  title       text not null,               -- "Account · Range"
  snapshot    jsonb not null,              -- ReportSnapshot (validado con Zod en lectura)
  revoked     boolean default false,
  created_at  timestamptz default now()
);

create index if not exists report_shares_token_idx on report_shares (token);

alter table report_shares enable row level security;

drop policy if exists "Users manage own shares" on report_shares;
create policy "Users manage own shares" on report_shares
  for all using (auth.uid() = user_id);
