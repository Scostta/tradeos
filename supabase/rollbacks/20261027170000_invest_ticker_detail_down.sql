-- ============================================================
-- ROLLBACK de 20261027170000_invest_ticker_detail.sql (página de detalle).
-- No vive en migrations/: se aplica a mano (SQL editor / psql) si hace falta.
--
-- Borra las tres tablas con sus datos, incluidos los borradores de tesis de
-- los usuarios (exportarlos antes si se quieren conservar). Antes, desplegar
-- un job y una app que no las usen: el upsert del job fallaría.
-- ============================================================

begin;

drop table if exists invest_thesis_drafts;
drop table if exists invest_fundamentals_history;
drop table if exists invest_tickers;

commit;
