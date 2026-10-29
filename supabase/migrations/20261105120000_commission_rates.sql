-- ============================================================
-- Trading · comisiones estimadas por cuenta e instrumento
--
-- El add-on de NinjaTrader y el CSV mandan comisión 0 cuando la cuenta no
-- tiene plantilla de comisiones en NinjaTrader (p. ej. APEX por Rithmic).
-- commission_rates guarda la tarifa ida y vuelta por contrato que el usuario
-- configura en /accounts; trades.commission_estimated marca las comisiones
-- calculadas con ella (se recalculan si cambia la tarifa; las reales del
-- bróker no se tocan nunca).
-- ============================================================

begin;

create table if not exists commission_rates (
  user_id     uuid references auth.users on delete cascade not null,
  account_id  uuid references accounts(id) on delete cascade not null,
  instrument  text not null check (instrument ~ '^[A-Z0-9]{1,10}$'),   -- símbolo raíz: NQ, MNQ…
  round_turn  numeric(8,2) not null check (round_turn >= 0),           -- $ por contrato, ida y vuelta
  updated_at  timestamptz not null default now(),
  primary key (account_id, instrument)
);

alter table commission_rates enable row level security;

drop policy if exists "Users manage own commission rates" on commission_rates;
create policy "Users manage own commission rates" on commission_rates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Desde el 2026-10-30 Supabase no da acceso Data API automático a tablas nuevas.
grant select on public.commission_rates to anon;
grant select, insert, update, delete on public.commission_rates to authenticated;
grant select, insert, update, delete on public.commission_rates to service_role;

alter table trades add column if not exists commission_estimated boolean not null default false;

commit;
