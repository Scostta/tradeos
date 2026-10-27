-- ============================================================
-- Módulo Invest — sector y divisa en invest_screen_results.
--
-- sector   (INVEST_SPEC.md §1.4) máximo 2 posiciones abiertas por sector. El
--          job guarda info.sector de Yahoo; openInvestPosition compara el
--          sector del ticker que se abre con el de las posiciones abiertas
--          (vía su run_id + ticker). Un sector null cuenta como un sector más.
-- currency (§5) divisa de cotización de price. La app valora el satélite en
--          EUR con los pares EUR{divisa}=X que el job guarda en invest_prices.
--
-- Los resultados existentes quedan con ambas columnas a null hasta que se
-- relance el job para su run_date.
-- ============================================================

alter table invest_screen_results add column if not exists sector text;
alter table invest_screen_results add column if not exists currency text;
