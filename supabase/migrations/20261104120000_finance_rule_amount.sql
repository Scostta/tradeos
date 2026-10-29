-- ============================================================
-- Money · reglas con importe exacto (MONEY_SPEC.md §2.4)
--
-- finance_category_rules.amount: si no es null, la regla solo casa con
-- movimientos cuyo importe absoluto es exactamente ese (p. ej. la retirada
-- de cajero de 500 € del alquiler → Housing, el resto → ATM withdrawals).
-- La unicidad pasa de (user_id, pattern) a (user_id, pattern, amount), con
-- nulls not distinct: sigue habiendo una sola regla "sin importe" por patrón.
-- ============================================================

begin;

alter table finance_category_rules
  add column if not exists amount numeric(12,2) check (amount is null or amount > 0);

alter table finance_category_rules
  drop constraint if exists finance_category_rules_user_id_pattern_key;

alter table finance_category_rules
  add constraint finance_category_rules_user_id_pattern_amount_key
    unique nulls not distinct (user_id, pattern, amount);

commit;
