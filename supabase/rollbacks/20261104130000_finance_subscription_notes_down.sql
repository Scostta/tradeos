-- ============================================================
-- ROLLBACK de 20261104130000_finance_subscription_notes.sql.
-- No vive en migrations/: se aplica a mano (SQL editor / psql) si hace falta.
-- Antes, desplegar una app que no lea notes. Se pierden las notas.
-- ============================================================

begin;

alter table finance_subscriptions drop column if exists notes;

commit;
