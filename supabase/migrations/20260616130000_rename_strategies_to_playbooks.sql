-- ============================================================
-- Rename strategies → playbooks (tabla, columna FK y policy).
-- Los datos se preservan (rename, no drop). Idempotente.
-- ============================================================

do $$ begin
  if exists (select from information_schema.tables
             where table_schema='public' and table_name='strategies') then
    alter table strategies rename to playbooks;
  end if;
end $$;

do $$ begin
  if exists (select from information_schema.columns
             where table_name='trades' and column_name='strategy_id') then
    alter table trades rename column strategy_id to playbook_id;
  end if;
end $$;

do $$ begin
  if exists (select from pg_policies
             where tablename='playbooks' and policyname='Users see own strategies') then
    alter policy "Users see own strategies" on playbooks rename to "Users see own playbooks";
  end if;
end $$;
