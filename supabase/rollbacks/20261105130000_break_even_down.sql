-- ============================================================
-- ROLLBACK de 20261105130000_break_even.sql.
-- No vive en migrations/: se aplica a mano (SQL editor / psql) si hace falta.
-- Antes, desplegar una app que no lea break_even, be_override ni
-- be_threshold_points. Se pierden las correcciones manuales.
-- ============================================================

begin;

drop trigger if exists trades_break_even on trades;
drop function if exists trades_set_break_even();
alter table trades drop column if exists break_even;
alter table trades drop column if exists be_override;
alter table profiles drop column if exists be_threshold_points;

commit;
