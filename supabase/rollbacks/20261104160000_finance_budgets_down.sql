-- ============================================================
-- ROLLBACK de 20261104160000_finance_budgets.sql.
-- No vive en migrations/: se aplica a mano (SQL editor / psql) si hace falta.
-- Antes, desplegar una app que no lea finance_budgets. Se pierden los presupuestos.
-- ============================================================

begin;

drop table if exists finance_budgets;

commit;
