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

Errores de red (DNS, conexión, timeout, 429 de Yahoo): un solo reintento a los
3 s por descarga. Si persiste, el ticker queda `no_data`. Si al terminar
`no_data` supera el 5 % del universo, el run se aborta **sin escribir nada** y
el job sale con código 1 (el resumen de Actions lista los tickers). yfinance se
configura con `debug.hide_exceptions = False` para que un fallo de red en los
estados financieros no se convierta en silencio en un fallo fundamental.

## Datos y decisiones

- **Precios**: `history(interval="1mo", auto_adjust=False)`, columna `Adj Close`.
  Las barras se indexan por mes (`YYYY-MM`); la del mes en curso es parcial y se
  descarta. `months_listed` cuenta los cierres de la ventana descargada (3 años),
  así que su máximo es ~36.
- **Página de detalle** (`/invest/[ticker]`, §4.7), de lo ya descargado, sin
  más llamadas a Yahoo: `invest_tickers` (nombre, sector, industria, resumen,
  divisas), `invest_fundamentals_history` (4 años fiscales con los mismos
  alias y criterios de `fundamentals.py`, en `history.py`) y 36 meses de
  cierres de todos los tickers evaluados en `invest_prices`.
- **Fundamentales**: último año fiscal (`income_stmt`, `cashflow`,
  `balance_sheet`) vs. el anterior. Los nombres de campo pasan por
  `FIELD_ALIASES` (solo variantes de nombre del mismo concepto). Si ninguno
  existe o el valor es NaN, el ratio queda **null y falla**; no hay cálculo
  alternativo. Única excepción: `Total Debt` ausente o NaN en un balance que sí
  cargó cuenta como 0 (Yahoo lo deja así en empresas sin deuda financiera);
  solo es null si el balance entero no está.
- **Denominadores ≤ 0** (EBITDA, capital invertido, ingresos): ratio null → falla.
  La caja neta (`net_debt <= 0`) pasa la regla de deuda aunque el EBITDA falte
  o sea negativo.
- Ratios redondeados a 4 decimales antes de aplicar umbrales (lo guardado
  reproduce la decisión); `|x| >= 10000` no cabe en `numeric(8,4)` → null.
- **Market cap** en USD al cierre de `run_date`: `Close[t] ×
  impliedSharesOutstanding × FX[t]` (`EURUSD=X`, …). No `info.marketCap`, que
  va al precio del día en que corre el job; no `sharesOutstanding`, que cuenta
  una sola clase de acción (GOOGL, BRK-B, RO.SW…). `Close` está ajustado por
  splits pero no por dividendos. Las cotizadas en Londres cotizan en `GBp`:
  precio / 100 y par GBP. Falta cualquier dato o divisa sin tipo → null →
  falla `market_cap`.
- **Sector**: `info.sector` tal cual, en `invest_screen_results.sector`. No es
  una regla del screener; lo usa la app para el máximo de 2 posiciones
  abiertas por sector (§1.4).
- **invest_prices** guarda `adj_close` y `close` (sin ajustar por dividendos)
  de la misma descarga mensual: la app usa `close` para el primer tramo del
  total return y para el P&L latente de Positions (§5.1).
- **Divisa**: `info.currency` en `invest_screen_results.currency`. El job
  guarda en `invest_prices` los pares `EUR{divisa}=X` (unidades por 1 EUR)
  para que la app valore el satélite en EUR (§5).
- **Benchmark** de `rel_strength_6m`: el `benchmark_ticker` más usado en
  `invest_settings` (`IWDA.AS` si no hay filas). Si falta su cierre del mes, el
  job aborta antes de escribir.
- `fail_reasons`: `no_data`, `market_cap`, `months_listed`, `revenue_growth`,
  `fcf_margin`, `gross_margin`, `net_debt_ebitda`, `roic`, `sma10m`,
  `momentum_12_1`, `rel_strength_6m`.
- Festivos NYSE: lista fija 2024–2030 en `market_calendar.py`; un año fuera de
  la lista lanza error. Un test la contrasta con `exchange_calendars`, que solo
  está en `requirements-dev.txt`.

## Fixtures

`tests/fixtures/*.json` son datos reales de Yahoo a 2026-09-30: GOOGL (pasa),
AAPL (falla `revenue_growth`), COST (falla `sma10m` y `rel_strength_6m`), ANET
(`Total Debt` NaN → 0) y el benchmark IWDA.AS. Para regenerarlos:
`python -m tests.fixtures.capture`.
