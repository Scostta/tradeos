-- ============================================================
-- ROLLBACK de 20261027140000_invest_reviews.sql (revisiones mensuales).
-- No vive en migrations/: se aplica a mano (SQL editor / psql) si hace falta.
--
-- Recrea invest_settings.last_reviewed_run_id con la revisión más reciente de
-- cada usuario (por run_date) y borra invest_reviews con su histórico.
-- Antes, desplegar una app que no lea invest_reviews.
-- ============================================================

begin;

alter table invest_settings
  add column if not exists last_reviewed_run_id uuid references invest_screen_runs(id) on delete set null;

update invest_settings s
set last_reviewed_run_id = latest.run_id
from (
  select distinct on (r.user_id) r.user_id, r.run_id
  from invest_reviews r
  join invest_screen_runs runs on runs.id = r.run_id
  order by r.user_id, runs.run_date desc
) latest
where latest.user_id = s.user_id;

drop table if exists invest_reviews;

commit;
