-- ============================================================
-- ROLLBACK de 20261027150000_invest_prices_close.sql (close sin ajustar).
-- No vive en migrations/: se aplica a mano (SQL editor / psql) si hace falta.
--
-- Antes, desplegar un job que no escriba la columna close y una app que no
-- la lea: el upsert de invest_prices fallaría con una columna inexistente.
-- ============================================================

alter table invest_prices drop column if exists close;
