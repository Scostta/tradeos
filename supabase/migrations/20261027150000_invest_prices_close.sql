-- ============================================================
-- Módulo Invest — cierre mensual SIN ajustar en invest_prices (INVEST_SPEC.md §5.1).
--
-- close: Close de Yahoo (ajustado por splits, no por dividendos). Lo usa la
-- app para el primer tramo del total return (compra → primer cierre mensual)
-- y para el P&L latente de Positions ("lo que tendría si vendiera hoy").
--
-- Las filas existentes quedan con close null hasta que el job las reescriba
-- (upsert por ticker, month_end en su siguiente run).
-- ============================================================

alter table invest_prices add column if not exists close numeric(12,4);
