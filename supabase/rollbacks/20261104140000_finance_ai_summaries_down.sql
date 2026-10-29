-- ============================================================
-- ROLLBACK de 20261104140000_finance_ai_summaries.sql.
-- No vive en migrations/: se aplica a mano (SQL editor / psql) si hace falta.
-- Antes, desplegar una app que no lea finance_ai_summaries.
-- ============================================================

begin;

drop table if exists finance_ai_summaries;

commit;
