-- ============================================================
-- Money · resumen del mes con IA (MONEY_SPEC.md §2.8, §5.8)
--
-- Una fila por usuario y mes. input_hash es el hash de las cifras enviadas:
-- si no cambian, se devuelve la guardada sin llamar a la API.
-- ============================================================

begin;

create table if not exists finance_ai_summaries (
  user_id     uuid references auth.users on delete cascade not null,
  month       text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  input_hash  text not null,
  content     jsonb not null,
  model       text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, month)
);

alter table finance_ai_summaries enable row level security;

drop policy if exists "Users manage own finance ai summaries" on finance_ai_summaries;
create policy "Users manage own finance ai summaries" on finance_ai_summaries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

commit;
