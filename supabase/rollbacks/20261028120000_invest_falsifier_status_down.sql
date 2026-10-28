-- ============================================================
-- ROLLBACK de 20261028120000_invest_falsifier_status.sql.
-- No vive en migrations/: se aplica a mano (SQL editor / psql) si hace falta.
--
-- Se pierden los estados "revisar" marcados a mano. Antes, desplegar una app
-- que no lea ni escriba falsifier_status.
-- ============================================================

begin;

alter table invest_positions drop constraint if exists invest_positions_falsifier_status_array;
alter table invest_positions drop column if exists falsifier_status;

commit;
