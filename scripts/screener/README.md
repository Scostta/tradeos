# Invest screener

Job mensual del módulo Invest (`INVEST_SPEC.md` §3). Evalúa el universo
(S&P 500 de Wikipedia + `universe_extra.csv`) al cierre del último día hábil
del mes anterior y escribe en Supabase `invest_screen_runs`,
`invest_screen_results`, `invest_position_checks` e `invest_prices`.

`screener/rules.py::evaluate()` es la **única** implementación de las reglas
de §1. La app solo lee lo que se guarda.

## Ejecución

En GitHub Actions (`.github/workflows/screener.yml`):

- `schedule` 07:00 UTC los días 1–4: solo trabaja el primer día hábil NYSE del
  mes; el resto de días sale sin hacer nada.
- `workflow_dispatch`: corre siempre. Input opcional `run_date`
  (último día hábil de un mes pasado, p. ej. `2026-09-30`); vacío = mes anterior.

Secrets del repo (Settings → Secrets and variables → Actions):

| Secret | Valor |
|---|---|
| `SUPABASE_URL` | URL del proyecto (`https://xxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key (escribe saltándose RLS) |

En local:

```bash
cd scripts/screener
python -m venv .venv && .venv/bin/pip install -r requirements-dev.txt   # Windows: .venv\Scripts\
python -m pytest
python -m screener --force --dry-run --limit 20        # sin Supabase
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python -m screener --force --run-date 2026-09-30
```

Un rerun del mismo `run_date` reutiliza la fila del run (mismo `id`) y rehace
resultados y checks: `invest_positions.run_id` apunta a él sin cascade.

## Datos y decisiones

- **Precios**: `history(interval="1mo", auto_adjust=False)`, columna `Adj Close`.
  Las barras se indexan por mes (`YYYY-MM`); la del mes en curso es parcial y se
  descarta. `months_listed` cuenta los cierres de la ventana descargada (2 años),
  así que su máximo es ~24.
- **Fundamentales**: último año fiscal (`income_stmt`, `cashflow`,
  `balance_sheet`) vs. el anterior. Los nombres de campo pasan por
  `FIELD_ALIASES` (solo variantes de nombre del mismo concepto). Si ninguno
  existe o el valor es NaN, el ratio queda **null y falla**; no hay cálculo
  alternativo. Consecuencia conocida: empresas sin deuda financiera para las
  que Yahoo da `Total Debt` = NaN (p. ej. ANET) fallan `net_debt_ebitda` y `roic`.
- **Denominadores ≤ 0** (EBITDA, capital invertido, ingresos): ratio null → falla.
  La caja neta (`net_debt <= 0`) pasa la regla de deuda aunque el EBITDA falte
  o sea negativo.
- Ratios redondeados a 4 decimales antes de aplicar umbrales (lo guardado
  reproduce la decisión); `|x| >= 10000` no cabe en `numeric(8,4)` → null.
- **Market cap** en USD: `info.marketCap × FX` del cierre de `run_date`
  (`EURUSD=X`, …). Las cotizadas en Londres declaran `GBp` pero Yahoo da su
  marketCap en libras. Divisa sin tipo → null → falla `market_cap`.
- **Benchmark** de `rel_strength_6m`: el `benchmark_ticker` más usado en
  `invest_settings` (`IWDA.AS` si no hay filas). Si falta su cierre del mes, el
  job aborta antes de escribir.
- `fail_reasons`: `no_data`, `market_cap`, `months_listed`, `revenue_growth`,
  `fcf_margin`, `gross_margin`, `net_debt_ebitda`, `roic`, `sma10m`,
  `momentum_12_1`, `rel_strength_6m`.
- Festivos NYSE: lista fija 2024–2030 en `market_calendar.py`; un año fuera de
  la lista lanza error.

## Fixtures

`tests/fixtures/*.json` son datos reales de Yahoo a 2026-09-30: GOOGL (pasa),
AAPL (falla `revenue_growth`), COST (falla `sma10m` y `rel_strength_6m`) y el
benchmark IWDA.AS. Para regenerarlos: `python -m tests.fixtures.capture`.
