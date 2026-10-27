-- ============================================================
-- ROLLBACK de 20261027160000_invest_paper.sql (posiciones de papel).
-- No vive en migrations/: se aplica a mano (SQL editor / psql) si hace falta.
--
-- BORRA las posiciones de papel (y sus checks, por cascade): el modelo
-- anterior no las distingue de las reales. Exportarlas antes si se quieren
-- conservar. started_at vuelve a not null (los null pasan a hoy).
-- Antes, desplegar una app y un job que no usen paper ni paper_mode.
-- ============================================================

begin;

delete from invest_positions where paper;

drop index if exists invest_positions_one_open_per_ticker;
create unique index invest_positions_one_open_per_ticker
  on invest_positions (user_id, ticker) where closed_at is null;

alter table invest_positions drop column if exists paper;

update invest_settings set started_at = current_date where started_at is null;
alter table invest_settings alter column started_at set default current_date;
alter table invest_settings alter column started_at set not null;
alter table invest_settings drop column if exists paper_mode;

commit;
