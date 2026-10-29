-- ============================================================
-- Money · presupuesto por mes y categoría (MONEY_SPEC.md §2.9, §5.9)
--
-- Una fila por usuario, mes (clave del periodo, con el día de inicio de los
-- ajustes) y categoría de gasto. La categoría Subscriptions no se guarda: su
-- presupuesto es el coste mensual de las suscripciones confirmadas.
-- ============================================================

begin;

create table if not exists finance_budgets (
  user_id      uuid references auth.users on delete cascade not null,
  month        text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  category_id  uuid references finance_categories(id) on delete cascade not null,
  amount       numeric(12,2) not null check (amount >= 0),
  primary key (user_id, month, category_id)
);

alter table finance_budgets enable row level security;

drop policy if exists "Users manage own finance budgets" on finance_budgets;
create policy "Users manage own finance budgets" on finance_budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

commit;
