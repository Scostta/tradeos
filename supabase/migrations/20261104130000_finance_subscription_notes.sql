-- ============================================================
-- Money · nota libre en cada suscripción (MONEY_SPEC.md §2.5)
--
-- La escribe el usuario desde Edit. El recálculo tras cada import no la toca
-- (no va en el upsert) y no cambia updated_at: así no tapa el aviso de una
-- cancelada que vuelve a cobrar.
-- ============================================================

begin;

alter table finance_subscriptions
  add column if not exists notes text check (char_length(notes) <= 500);

commit;
