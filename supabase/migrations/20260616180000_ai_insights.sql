-- ============================================================
-- AI Insights generados por Claude. Una fila por scope:
--   - global  (account_id null)
--   - por cuenta (account_id not null)
-- `input_hash` es el hash del payload determinista (InsightsInput). Si el hash
-- almacenado coincide con el de los datos actuales, se sirve el caché y NO se
-- vuelve a llamar a la API (control de coste). Idempotente.
-- ============================================================
create table if not exists ai_insights (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users not null,
  account_id   uuid references accounts(id) on delete cascade,  -- null = todas las cuentas
  input_hash   text not null,        -- sha256 del InsightsInput que generó estos insights
  insights     jsonb not null,       -- Insight[] validado con Zod en la capa de servicio
  model        text not null,        -- modelo usado (ej. claude-opus-4-8)
  trades_count integer not null,     -- nº de trades analizados (para mostrar contexto)
  generated_at timestamptz default now()
);

-- Una fila global por usuario, una por (usuario, cuenta) — mismo patrón que user_goals.
create unique index if not exists ai_insights_global_uniq
  on ai_insights (user_id) where account_id is null;
create unique index if not exists ai_insights_account_uniq
  on ai_insights (user_id, account_id) where account_id is not null;

alter table ai_insights enable row level security;

drop policy if exists "Users manage own insights" on ai_insights;
create policy "Users manage own insights" on ai_insights
  for all using (auth.uid() = user_id);
