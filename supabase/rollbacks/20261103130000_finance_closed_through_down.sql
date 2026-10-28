-- ============================================================
-- ROLLBACK de 20261103130000_finance_closed_through.sql.
-- No vive en migrations/: se aplica a mano (SQL editor / psql) si hace falta.
-- Antes, desplegar una app que no lea closed_through.
-- ============================================================

begin;

alter table finance_settings drop column if exists closed_through;

commit;
