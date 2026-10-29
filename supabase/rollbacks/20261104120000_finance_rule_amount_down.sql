-- ============================================================
-- ROLLBACK de 20261104120000_finance_rule_amount.sql.
-- No vive en migrations/: se aplica a mano (SQL editor / psql) si hace falta.
-- Antes, desplegar una app que no lea amount. Borra las reglas con importe
-- (no caben en la unicidad antigua); lo que categorizaban queda por regla y
-- se recoloca al reaplicar.
-- ============================================================

begin;

alter table finance_category_rules
  drop constraint if exists finance_category_rules_user_id_pattern_amount_key;

delete from finance_category_rules where amount is not null;

alter table finance_category_rules drop column if exists amount;

alter table finance_category_rules
  add constraint finance_category_rules_user_id_pattern_key unique (user_id, pattern);

commit;
