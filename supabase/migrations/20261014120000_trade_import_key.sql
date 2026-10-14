-- ============================================================
-- Dedupe del import por huella del trade en vez de por "Trade number".
--
-- El "Trade number" de NinjaTrader es la posición de la fila en cada export
-- del Trade Performance (se reinicia en 1), así que dos CSVs de días distintos
-- comparten #1, #2... y la clave (account_id, trade_number) los marcaba como
-- duplicados (y el upsert con ignoreDuplicates los descartaba en silencio).
--
-- Nueva clave: (account_id, import_key), con
--   import_key = instrument|direction|contracts|entry epoch|exit epoch|entry price|exit price#n
-- donde n es la aparición n-ésima de esa huella en la cuenta. Mantener en sync
-- con tradeFingerprint() / withImportKeys() en src/helpers/trade-fingerprint.ts.
--
-- - trades: se añade import_key y se rellena para los trades importados. Los
--   manuales quedan con import_key null (no participan en el dedupe).
--   trade_number se conserva solo para mostrarlo.
-- - import_exclusions: las exclusiones existentes no se pueden traducir (el
--   trade excluido se borró de trades, no queda de dónde sacar la huella) y
--   con la clave vieja marcaban como SKIPPED trades nuevos con el mismo número.
--   Se copian a import_exclusions_legacy_backup y se borran.
-- Rollback: supabase/rollbacks/20261014120000_trade_import_key_down.sql
-- ============================================================

begin;

-- ── trades ──────────────────────────────────────────────────────────────────
alter table trades add column if not exists import_key text;

with fp as (
  select
    id,
    account_id,
    trade_number,
    created_at,
    instrument
      || '|' || direction
      || '|' || contracts::text
      || '|' || floor(extract(epoch from entry_time))::bigint::text
      || '|' || floor(extract(epoch from exit_time))::bigint::text
      || '|' || entry_price::numeric(12,4)::text
      || '|' || exit_price::numeric(12,4)::text as fingerprint
  from trades
  where source = 'import' and import_key is null
),
numbered as (
  select
    id,
    fingerprint || '#' || row_number() over (
      partition by account_id, fingerprint
      order by trade_number nulls last, created_at, id
    ) as import_key
  from fp
)
update trades t
set import_key = n.import_key
from numbered n
where t.id = n.id;

-- Quita el índice único viejo sobre (account_id, trade_number), se llame como se llame.
do $$
declare idx record;
begin
  for idx in
    select i.relname as name
    from pg_index x
    join pg_class i on i.oid = x.indexrelid
    join pg_class t on t.oid = x.indrelid
    where t.relname = 'trades'
      and x.indisunique
      and not x.indisprimary
      and (
        select array_agg(a.attname::text order by a.attname)
        from pg_attribute a
        where a.attrelid = t.oid and a.attnum = any(x.indkey)
      ) = array['account_id', 'trade_number']
  loop
    execute format('drop index if exists %I', idx.name);
  end loop;
end $$;

create unique index if not exists trades_import_key_unique
  on trades (account_id, import_key);

-- ── import_exclusions ───────────────────────────────────────────────────────
create table if not exists import_exclusions_legacy_backup as
  select * from import_exclusions where false;

-- Sin políticas: solo accesible con service role.
alter table import_exclusions_legacy_backup enable row level security;

insert into import_exclusions_legacy_backup
  select * from import_exclusions;

delete from import_exclusions;

alter table import_exclusions
  drop constraint if exists import_exclusions_account_id_trade_number_key;

alter table import_exclusions alter column trade_number drop not null;
alter table import_exclusions add column if not exists import_key text not null;

alter table import_exclusions
  add constraint import_exclusions_account_id_import_key_key
  unique (account_id, import_key);

commit;
