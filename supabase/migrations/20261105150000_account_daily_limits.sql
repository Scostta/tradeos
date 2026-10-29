-- ============================================================
-- Trading · límites diarios personales por cuenta
--
-- Disciplina, no reglas del prop firm (esas siguen en daily_loss_limit):
-- máximo de trades al día, pérdida máxima del día (neta, positiva) y parar
-- tras N pérdidas seguidas (los BE no cuentan). null = sin límite. /review
-- marca los trades abiertos después de llegar a un límite.
-- ============================================================

begin;

alter table accounts add column if not exists max_trades_per_day integer
  check (max_trades_per_day > 0);
alter table accounts add column if not exists max_daily_loss numeric(12,2)
  check (max_daily_loss > 0);
alter table accounts add column if not exists max_consecutive_losses integer
  check (max_consecutive_losses > 0);

commit;
