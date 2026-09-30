-- ============================================================
-- Trades excluidos del import.
-- Cada fila marca un trade del CSV que el usuario NO quiere en la app (típico:
-- scratches / BE de <$2 que ensucian las métricas). El import consulta esta
-- tabla antes de insertar, así un re-import del mismo CSV no los resucita.
-- La clave es la misma que dedupe de trades: (account_id, trade_number).
-- ============================================================
create table if not exists import_exclusions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users on delete cascade not null,
  account_id   uuid references accounts(id) on delete cascade not null,
  trade_number integer not null,
  created_at   timestamptz default now(),
  unique (account_id, trade_number)
);

create index if not exists import_exclusions_user_idx
  on import_exclusions (user_id);

alter table import_exclusions enable row level security;

drop policy if exists "Users manage own import exclusions" on import_exclusions;
create policy "Users manage own import exclusions" on import_exclusions
  for all using (auth.uid() = user_id);
