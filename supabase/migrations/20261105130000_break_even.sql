-- ============================================================
-- Trading · trades break-even (BE)
--
-- Un trade es BE si la diferencia entre entrada y salida es ≤ el umbral del
-- usuario en puntos (profiles.be_threshold_points, 1,5 por defecto), salvo que
-- el usuario lo corrija a mano (trades.be_override: true = BE, false = no BE,
-- null = automático). trades.break_even lo calcula un trigger en cada insert o
-- update, así que vale para el add-on, el CSV y los trades manuales. Los BE
-- siguen sumando en el P&L, pero no cuentan como ganadores ni perdedores.
-- ============================================================

begin;

alter table profiles add column if not exists be_threshold_points numeric(6,2) not null default 1.5
  check (be_threshold_points >= 0);

alter table trades add column if not exists be_override boolean;
alter table trades add column if not exists break_even boolean not null default false;

create or replace function trades_set_break_even() returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.break_even := coalesce(
    new.be_override,
    abs(new.exit_price - new.entry_price) <= coalesce(
      (select p.be_threshold_points from profiles p where p.user_id = new.user_id), 1.5)
  );
  return new;
end;
$$;

drop trigger if exists trades_break_even on trades;
create trigger trades_break_even
  before insert or update of entry_price, exit_price, be_override on trades
  for each row execute function trades_set_break_even();

-- Trades existentes.
update trades t set break_even = coalesce(
  t.be_override,
  abs(t.exit_price - t.entry_price) <= coalesce(
    (select p.be_threshold_points from profiles p where p.user_id = t.user_id), 1.5)
);

commit;
