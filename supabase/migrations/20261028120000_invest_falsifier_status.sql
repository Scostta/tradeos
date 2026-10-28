-- ============================================================
-- Módulo Invest — estado manual de los falsadores (INVEST_SPEC.md §4.3).
--
-- invest_positions.falsifier_status
--   array jsonb alineado con `falsifiers` por índice: "ok" (sin novedad) o
--   "review" (revisar). Lo marca el usuario a mano en
--   /invest/positions/[id]; no lo toca el job ni decide nada (la salida
--   sigue siendo la de §1.4). Un índice que falta cuenta como "ok".
-- ============================================================

begin;

alter table invest_positions
  add column if not exists falsifier_status jsonb not null default '[]'::jsonb;

alter table invest_positions drop constraint if exists invest_positions_falsifier_status_array;
alter table invest_positions
  add constraint invest_positions_falsifier_status_array
  check (jsonb_typeof(falsifier_status) = 'array');

commit;
