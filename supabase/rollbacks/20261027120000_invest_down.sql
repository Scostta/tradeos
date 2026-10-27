-- ============================================================
-- ROLLBACK de 20261027120000_invest.sql (módulo Invest).
-- No vive en migrations/: se aplica a mano (SQL editor / psql) si hace falta.
--
-- Borra todas las tablas del módulo con sus datos (runs, resultados, precios,
-- posiciones con tesis y falsadores, ajustes). No hay backup: exportar antes
-- invest_positions si se quiere conservar el diario de la hipótesis.
-- Todo corre en una transacción.
-- ============================================================

begin;

drop table if exists invest_position_checks;
drop table if exists invest_prices;
drop table if exists invest_settings;
drop table if exists invest_positions;
drop table if exists invest_screen_results;
drop table if exists invest_screen_runs;

commit;
