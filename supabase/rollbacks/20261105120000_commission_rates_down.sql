-- ============================================================
-- ROLLBACK de 20261105120000_commission_rates.sql.
-- No vive en migrations/: se aplica a mano (SQL editor / psql) si hace falta.
-- Antes, desplegar una app que no lea commission_rates ni commission_estimated.
-- Las comisiones ya estimadas quedan en trades.commission (no se deshacen).
-- ============================================================

begin;

drop table if exists commission_rates;
alter table trades drop column if exists commission_estimated;

commit;
