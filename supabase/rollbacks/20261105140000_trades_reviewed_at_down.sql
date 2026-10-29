-- ============================================================
-- ROLLBACK de 20261105140000_trades_reviewed_at.sql.
-- No vive en migrations/: se aplica a mano (SQL editor / psql) si hace falta.
-- Antes, desplegar una app que no lea ni escriba reviewed_at.
-- ============================================================

begin;

alter table trades drop column if exists reviewed_at;

commit;
