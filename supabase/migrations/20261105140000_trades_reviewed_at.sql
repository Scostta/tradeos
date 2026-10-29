-- ============================================================
-- Trading · trades.reviewed_at
--
-- Guardar un trade en el repaso de sesión (/review) lo marca como revisado,
-- tenga playbook o no. Antes solo contaba como revisado con playbook y
-- checklist, así que un trade guardado sin playbook seguía pendiente.
-- Un trade con playbook y checklist sigue contando como revisado aunque
-- no tenga reviewed_at (se calificó desde la ficha del trade).
-- ============================================================

begin;

alter table trades add column if not exists reviewed_at timestamptz;

commit;
