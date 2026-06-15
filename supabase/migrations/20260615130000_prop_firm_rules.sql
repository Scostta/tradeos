-- ============================================================
-- Reglas de prop firm por cuenta (configurable por cuenta).
-- Idempotente: re-ejecutable sin error.
-- ============================================================

alter table accounts add column if not exists prop_phase        text;
alter table accounts add column if not exists drawdown_type     text;
alter table accounts add column if not exists drawdown_amount   numeric(12,2);
alter table accounts add column if not exists drawdown_lock_at  numeric(12,2);
alter table accounts add column if not exists daily_loss_limit  numeric(12,2);
alter table accounts add column if not exists profit_target     numeric(12,2);
alter table accounts add column if not exists min_trading_days  integer;

-- Constraints de dominio (drop+create para idempotencia)
alter table accounts drop constraint if exists accounts_prop_phase_check;
alter table accounts add  constraint accounts_prop_phase_check
  check (prop_phase is null or prop_phase in ('evaluation', 'funded', 'payout'));

alter table accounts drop constraint if exists accounts_drawdown_type_check;
alter table accounts add  constraint accounts_drawdown_type_check
  check (drawdown_type is null or drawdown_type in ('trailing_intraday', 'trailing_eod', 'static'));
