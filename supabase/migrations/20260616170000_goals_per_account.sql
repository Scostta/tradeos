-- ============================================================
-- Goals por cuenta + globales. user_goals pasa de "una fila por usuario" a
-- "una global (account_id null) + una por cuenta". Idempotente. Datos previos
-- (fila global existente) se preservan con account_id null.
-- ============================================================

alter table user_goals add column if not exists account_id uuid references accounts(id) on delete cascade;
alter table user_goals add column if not exists id uuid;

update user_goals set id = gen_random_uuid() where id is null;
alter table user_goals alter column id set default gen_random_uuid();
alter table user_goals alter column id set not null;

-- Cambiar PK de user_id → id (permite varias filas por usuario)
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'user_goals_pkey') then
    alter table user_goals drop constraint user_goals_pkey;
  end if;
end $$;
alter table user_goals add constraint user_goals_pkey primary key (id);

-- Unicidad: una fila global por usuario, una por (usuario, cuenta)
create unique index if not exists user_goals_global_uniq
  on user_goals (user_id) where account_id is null;
create unique index if not exists user_goals_account_uniq
  on user_goals (user_id, account_id) where account_id is not null;
