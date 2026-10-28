-- ============================================================
-- Money · cierre de mes de los objetivos (MONEY_SPEC.md §4.5)
--
-- finance_settings.closed_through = último mes ('YYYY-MM', con el día de
-- inicio de los ajustes) cuyo ahorro real ya se repartió entre los objetivos.
-- null = ninguno todavía. El cierre lo reclama con un update condicional
-- sobre este valor, así dos visitas a la vez no reparten dos veces.
-- ============================================================

begin;

alter table finance_settings
  add column if not exists closed_through text
    check (closed_through ~ '^\d{4}-(0[1-9]|1[0-2])$');

commit;
