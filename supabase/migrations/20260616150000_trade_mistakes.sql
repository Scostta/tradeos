-- ============================================================
-- Tagging de errores por trade (revenge, moved stop, oversized…).
-- Separado de `tags` (genéricos). Idempotente.
-- ============================================================
alter table trades add column if not exists mistakes text[];
