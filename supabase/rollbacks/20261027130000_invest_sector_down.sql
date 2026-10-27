-- ============================================================
-- ROLLBACK de 20261027130000_invest_sector.sql (sector y divisa en resultados).
-- No vive en migrations/: se aplica a mano (SQL editor / psql) si hace falta.
--
-- Antes de aplicarlo, desplegar un job que no escriba estas columnas: el
-- insert de resultados fallaría con columnas inexistentes.
-- ============================================================

begin;

alter table invest_screen_results drop column if exists currency;
alter table invest_screen_results drop column if exists sector;

commit;
