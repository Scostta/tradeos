-- ============================================================
-- ROLLBACK de 20261014120000_trade_import_key.sql (import_key → trade_number).
-- No vive en migrations/: se aplica a mano (SQL editor / psql) si hace falta.
--
-- - Restaura las exclusiones legacy desde import_exclusions_legacy_backup. Las
--   exclusiones creadas después de la migración se pierden (no tienen
--   trade_number fiable).
-- - Recrea el índice único (account_id, trade_number). Falla si desde la
--   migración se han importado trades que repiten número en la misma cuenta
--   (justo el caso que la migración arregla): en ese caso hay que borrar esos
--   trades antes de reintentarlo.
-- Todo corre en una transacción.
-- ============================================================

begin;

drop index if exists trades_import_key_unique;

create unique index trades_no_duplicates
  on trades (account_id, trade_number);

alter table trades drop column if exists import_key;

alter table import_exclusions
  drop constraint if exists import_exclusions_account_id_import_key_key;

delete from import_exclusions;

alter table import_exclusions drop column if exists import_key;

insert into import_exclusions
  select * from import_exclusions_legacy_backup;

alter table import_exclusions alter column trade_number set not null;

alter table import_exclusions
  add constraint import_exclusions_account_id_trade_number_key
  unique (account_id, trade_number);

drop table import_exclusions_legacy_backup;

commit;
