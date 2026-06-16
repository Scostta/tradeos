-- ============================================================
-- Metas mensuales por usuario (una fila por usuario). Idempotente.
-- ============================================================
create table if not exists user_goals (
  user_id            uuid primary key references auth.users not null,
  monthly_pnl_target numeric(12,2),
  win_rate_target    numeric(5,4),    -- 0..1
  max_drawdown_limit numeric(12,2),   -- máximo drawdown permitido (positivo)
  min_trading_days   integer,
  updated_at         timestamptz default now()
);

alter table user_goals enable row level security;

drop policy if exists "Users manage own goals" on user_goals;
create policy "Users manage own goals" on user_goals
  for all using (auth.uid() = user_id);
