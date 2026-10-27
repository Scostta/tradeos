-- ============================================================
-- Módulo Invest — revisiones mensuales (INVEST_SPEC.md §4.6).
--
-- invest_reviews: una fila por usuario y run revisado. Se inserta al visitar
-- la pestaña Screen con el run vigente (el del mes en curso). La pestaña
-- Performance calcula "% de meses con revisión" = runs desde started_at con
-- fila aquí / runs desde started_at.
--
-- Sustituye a invest_settings.last_reviewed_run_id, que solo guardaba la
-- última revisión y no permitía calcular el histórico: se elimina.
-- ============================================================

begin;

create table if not exists invest_reviews (
  user_id      uuid references auth.users on delete cascade not null,
  run_id       uuid references invest_screen_runs(id) on delete cascade not null,
  reviewed_at  timestamptz not null default now(),
  primary key (user_id, run_id)
);

alter table invest_reviews enable row level security;

drop policy if exists "Users manage own invest reviews" on invest_reviews;
create policy "Users manage own invest reviews" on invest_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table invest_settings drop column if exists last_reviewed_run_id;

commit;
