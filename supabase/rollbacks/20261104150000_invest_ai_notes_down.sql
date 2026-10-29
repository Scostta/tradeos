-- ============================================================
-- ROLLBACK de 20261104150000_invest_ai_notes.sql.
-- No vive en migrations/: se aplica a mano (SQL editor / psql) si hace falta.
-- Antes, desplegar una app que no lea invest_ai_notes.
-- ============================================================

begin;

drop table if exists invest_ai_notes;

commit;
