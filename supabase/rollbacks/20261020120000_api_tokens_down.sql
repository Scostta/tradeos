-- Rollback de 20261020120000_api_tokens.sql
-- Los trades con source = 'sync' se conservan (son trades normales).
drop table if exists api_tokens;
