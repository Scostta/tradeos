-- ============================================================
-- Invest · notas de IA por usuario (INVEST_SPEC.md §2.8, §4.8)
--
-- kind 'picks': comentario de los tickers que pasan un run (position_id null).
-- kind 'review': revisión de los falsadores de una posición en un run.
-- input_hash: si los datos enviados no cambian, no se vuelve a llamar a la API.
-- ============================================================

begin;

create table if not exists invest_ai_notes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users on delete cascade not null,
  kind         text not null check (kind in ('picks', 'review')),
  run_id       uuid references invest_screen_runs(id) on delete cascade not null,
  position_id  uuid references invest_positions(id) on delete cascade,
  input_hash   text not null,
  content      jsonb not null,
  model        text not null,
  created_at   timestamptz not null default now(),
  check ((kind = 'review') = (position_id is not null)),
  constraint invest_ai_notes_scope_key unique nulls not distinct (user_id, kind, run_id, position_id)
);

alter table invest_ai_notes enable row level security;

drop policy if exists "Users manage own invest ai notes" on invest_ai_notes;
create policy "Users manage own invest ai notes" on invest_ai_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

commit;
