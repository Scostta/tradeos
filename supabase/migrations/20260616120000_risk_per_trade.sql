-- ============================================================
-- Riesgo fijo por trade a nivel de cuenta — fallback para R-múltiplos
-- cuando un trade no tiene stop_price. Idempotente.
-- ============================================================
alter table accounts add column if not exists risk_per_trade numeric(12,2);
