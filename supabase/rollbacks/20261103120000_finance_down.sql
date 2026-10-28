-- ============================================================
-- ROLLBACK de 20261103120000_finance.sql (módulo Money).
-- No vive en migrations/: se aplica a mano (SQL editor / psql) si hace falta.
--
-- BORRA todos los datos de Money: cuentas, movimientos, categorías, reglas,
-- suscripciones, objetivos y ajustes. Exportarlos antes si se quieren
-- conservar. Antes, desplegar una app que no use /money.
-- ============================================================

begin;

drop table if exists finance_settings;
drop table if exists finance_goals;
drop table if exists finance_subscriptions;
drop table if exists finance_category_rules;
drop table if exists finance_transactions;
drop table if exists finance_categories;
drop table if exists finance_accounts;

commit;
