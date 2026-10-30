-- ============================================================
-- ROLLBACK de 20261105170000_push_subscriptions.sql.
-- No vive en migrations/: se aplica a mano (SQL editor / psql) si hace falta.
-- Antes, desplegar una app que no lea esta tabla. Se pierden las suscripciones.
-- ============================================================

begin;

drop table if exists push_subscriptions;

commit;
