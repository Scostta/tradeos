-- ============================================================
-- ROLLBACK de 20261105150000_account_daily_limits.sql.
-- No vive en migrations/: se aplica a mano (SQL editor / psql) si hace falta.
-- Antes, desplegar una app que no lea estas columnas. Se pierden los límites.
-- ============================================================

begin;

alter table accounts drop column if exists max_trades_per_day;
alter table accounts drop column if exists max_daily_loss;
alter table accounts drop column if exists max_consecutive_losses;

commit;
