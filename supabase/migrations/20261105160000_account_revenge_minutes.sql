-- ============================================================
-- Trading · reentrada tras una pérdida (revenge) por cuenta
--
-- Con revenge_minutes, /review marca los trades abiertos menos de N minutos
-- después de cerrar una pérdida (ese día y en esa cuenta) y los abiertos con
-- más contratos que esa pérdida. 5 por defecto, también en las cuentas que ya
-- existen; null = sin marca. Columna nueva en una tabla existente: no hace
-- falta GRANT.
-- ============================================================

begin;

alter table accounts add column if not exists revenge_minutes integer default 5
  check (revenge_minutes > 0);

commit;
