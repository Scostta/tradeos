-- ============================================================
-- ROLLBACK de 20261105160000_account_revenge_minutes.sql.
-- No vive en migrations/: se aplica a mano (SQL editor / psql) si hace falta.
-- Antes, desplegar una app que no lea esta columna.
-- ============================================================

begin;

alter table accounts drop column if exists revenge_minutes;

commit;
