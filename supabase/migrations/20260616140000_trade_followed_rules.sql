-- ============================================================
-- Adherencia al playbook por trade: qué reglas se cumplieron.
-- Guarda los textos de las reglas marcadas (robusto a edición del playbook).
-- Idempotente.
-- ============================================================
alter table trades add column if not exists followed_rules text[];
