# INVEST — Núcleo/satélite con screener mensual

Módulo nuevo de TradeOS: gestión de una cartera de largo plazo con **núcleo indexado** (fuera de la app, solo se registra su benchmark) y **satélite de acciones individuales** decidido una vez al mes con un screener de reglas fijas. Es la hipótesis 13 del pipeline: forward test de 3 años, satélite vs. núcleo neto de impuestos, sin backtest.

Principio de diseño: **el screener dice qué se puede comprar; el usuario decide si lo compra con una tesis escrita.** La app impide abrir una posición que no esté en la lista aprobada del mes, y obliga a escribir tesis y falsadores antes de guardar.

Lo que NO se construye (ver §9): backtest, alertas, integración con bróker, cotizaciones intradía, optimización de parámetros.

---

## 1. Reglas (fijas; no se tocan sin cambiar esta spec)

### 1.1 Universo
- Constituyentes actuales del **S&P 500** (lista de Wikipedia, scrapeada en el job) + `scripts/screener/universe_extra.csv` (tickers Yahoo de grandes capitalizadas europeas, mantenido a mano; empieza con ~40).
- Capitalización > 2.000 M USD, **al cierre de `run_date`**: `market_cap = Close[t] × info.impliedSharesOutstanding × FX[t]`. No se usa `info.marketCap` (va al precio del momento de ejecutar el job, no al de `run_date`). `Close` es el cierre ajustado por splits pero no por dividendos (el precio real de ese día). `impliedSharesOutstanding` suma todas las clases de acción; `sharesOutstanding` es solo la clase cotizada. FX: cierre mensual del par de Yahoo (`EURUSD=X`, …) a `run_date`; las cotizadas en Londres cotizan en `GBp` (peniques) → precio / 100 y par GBP. Precio, acciones, divisa con par conocido o cierre del par ausente → `market_cap` null → falla.
- Al menos **12 meses de cotización** (hay que poder calcular momentum 12-1). Las IPOs recientes quedan fuera automáticamente.

### 1.2 Filtro fundamental (calidad, no "barato")
Todas obligatorias. Un ratio que no se puede calcular (`null`) **falla** el filtro; no se asume.
- Denominador ≤ 0 (ingresos, EBITDA, capital invertido) → ratio `null` → falla. En deuda: EBITDA ≤ 0 con deuda neta > 0 falla; la caja neta (`net_debt <= 0`) pasa aunque el EBITDA falte o sea negativo.
- **Excepción**: `TotalDebt` ausente o NaN en un balance que sí cargó (hay Cash, StockholdersEquity, etc.) cuenta como **0** (Yahoo lo deja así en empresas sin deuda financiera, p. ej. ANET). Solo es `null` si el balance entero no está.

| Regla | Cálculo (yfinance) |
|---|---|
| Ingresos creciendo | `revenue_growth_yoy > 0.10` — último año fiscal vs. anterior (`income_stmt` TotalRevenue) |
| Caja libre positiva | `fcf_margin > 0` — `cashflow` FreeCashFlow / TotalRevenue |
| Margen bruto estable | `gross_margin >= gross_margin_prev - 0.01` — GrossProfit / TotalRevenue, año actual vs. anterior |
| Deuda controlada | `net_debt_ebitda < 2` o caja neta (`net_debt <= 0`) — (TotalDebt − CashAndCashEquivalents) / EBITDA |
| Rentabilidad del capital | `roic > 0.10` — EBIT × (1 − 0,21) / (TotalDebt + StockholdersEquity − Cash) |

Sin PER, sin "ha caído un X %". Documentado así a propósito.

### 1.3 Filtro técnico (confirmación del mercado)
Sobre **cierres mensuales ajustados** (Yahoo `Adj Close`, último cierre de cada mes):

| Regla | Cálculo |
|---|---|
| Por encima de la media de 10 meses | `price > sma10m` — media simple de los 10 últimos cierres mensuales (incluido el actual) |
| Momentum 12-1 positivo | `momentum_12_1 = P[t-1] / P[t-12] - 1 > 0` |
| Fuerza relativa positiva | `rel_strength_6m = (P[t]/P[t-6]) - (B[t]/B[t-6]) > 0`, con `B` = benchmark (§1.5) |

### 1.4 Ejecución y gestión
- Se decide solo con el run del **primer día hábil del mes** (§3). Si no hay run del mes en curso, la app no deja abrir posiciones.
- Máximo **5 posiciones** abiertas, y como máximo **2 abiertas por sector** (`info.sector` de Yahoo, guardado por el job en `invest_screen_results.sector`; el de una posición es el de su fila en el run que la aprobó). Un sector null cuenta como un sector más. Tamaño objetivo **4 % del patrimonio total** por posición (el satélite es el 20 %). La app sugiere el importe y bloquea la 6ª.
- **Nunca se promedia a la baja**: no se puede abrir una segunda posición en un ticker ya abierto.
- Salida mecánica: en el run mensual, si `price < sma10m` para una posición abierta → señal `sell`. La app lo marca y precarga el cierre con motivo `sma_exit`.
- Salida discrecional: al abrir, el usuario escribe **≥ 2 falsadores** de la tesis. Si se cumple uno, cierra con motivo `falsifier` indicando cuál.
- Cierre `manual` permitido pero obliga a escribir motivo; cuenta como desviación en el reporte.

### 1.5 Benchmark
- `IWDA.AS` (iShares Core MSCI World, EUR, acumulación) en Yahoo, cierres mensuales ajustados. Representa el núcleo.
- Si el usuario tiene otro fondo, lo cambia en ajustes (§2.4); el job lee el ticker de ahí.

### 1.6 Evaluación de la hipótesis
- Horizonte: **36 meses** desde `invest_settings.started_at`.
- **Modo papel** (`invest_settings.paper_mode = true`, estado inicial): el modal abre posiciones de **papel** (`invest_positions.paper = true`), con las mismas validaciones de servidor (run vigente, ticker aprobado, máx. 5, máx. 2 por sector, sin duplicar ticker) y los mismos checks `hold`/`sell` del job. Sirven para ensayar; nunca cuentan para el test.
- El usuario sale del modo papel con **"Start real test"** en ajustes (`paper_mode = false`, sin vuelta atrás desde la UI). Desde ahí el modal abre posiciones reales, y `started_at` se fija **solo** al abrir la primera con `paper = false` (= su `opened_at`). Las posiciones de papel que sigan abiertas se mantienen (y reciben checks), pero **no cuentan** para el máximo de 5, el de sector ni el de ticker duplicado: los límites se cuentan solo entre las posiciones del modo actual.
- Métrica: rentabilidad del satélite neta de costes e impuestos estimados vs. rentabilidad del benchmark en el mismo periodo, ambas como TWR mensual encadenada (§5).
- La app muestra "mes X de 36" y la diferencia acumulada. Si a los 36 meses el satélite no bate al benchmark, se liquida. El criterio queda escrito aquí; no se decide al final.

---

## 2. Schema (Supabase)

Migración `supabase/migrations/20261027120000_invest.sql`, rollback en `supabase/rollbacks/20261027120000_invest_down.sql`, y añadir las tablas a `supabase/schema.sql`. Misma cabecera comentada que las migraciones existentes.

### 2.1 `invest_screen_runs` — un run por mes (datos compartidos, no por usuario)
```sql
create table if not exists invest_screen_runs (
  id             uuid primary key default gen_random_uuid(),
  run_date       date not null unique,       -- fecha del cierre mensual evaluado (último día hábil del mes anterior)
  executed_at    timestamptz default now(),
  universe_size  integer not null,
  passed_count   integer not null,
  benchmark      text not null,               -- ticker usado (IWDA.AS)
  job_version    text not null                -- git sha del job
);
```
RLS: `select` para `authenticated`; sin políticas de escritura (solo service role).

### 2.2 `invest_screen_results` — todos los tickers evaluados en cada run
Se guardan **todos**, no solo los que pasan, para poder ver por qué algo no pasa (p. ej. LULU).
```sql
create table if not exists invest_screen_results (
  id                  uuid primary key default gen_random_uuid(),
  run_id              uuid references invest_screen_runs(id) on delete cascade not null,
  ticker              text not null,
  name                text,
  exchange            text,
  sector              text,                    -- info.sector (§1.4); migración 20261027130000_invest_sector.sql
  currency            text,                    -- divisa de price (§5); misma migración
  market_cap          numeric(16,0),
  revenue_growth_yoy  numeric(8,4),
  fcf_margin          numeric(8,4),
  gross_margin        numeric(8,4),
  gross_margin_prev   numeric(8,4),
  net_debt_ebitda     numeric(8,4),
  roic                numeric(8,4),
  price               numeric(12,4),
  sma10m              numeric(12,4),
  momentum_12_1       numeric(8,4),
  rel_strength_6m     numeric(8,4),
  months_listed       integer,
  passes_fundamental  boolean not null,
  passes_technical    boolean not null,
  passes              boolean not null,       -- fundamental and technical and months_listed >= 12 and market_cap > 2e9
  fail_reasons        text[] not null default '{}',  -- p.ej. {'revenue_growth','sma10m'}
  unique (run_id, ticker)
);
create index on invest_screen_results (run_id, passes);
```
RLS: `select` para `authenticated`; escritura solo service role.

### 2.3 `invest_positions` — por usuario
```sql
create table if not exists invest_positions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users on delete cascade not null,
  ticker        text not null,
  run_id        uuid references invest_screen_runs(id) not null,  -- run que lo aprobó
  opened_at     date not null,
  entry_price   numeric(12,4) not null,
  shares        numeric(14,4) not null,
  fees_open     numeric(10,2) default 0,
  thesis        text not null,
  falsifiers    text[] not null,              -- check: array_length >= 2
  falsifier_status jsonb not null default '[]', -- "ok" | "review" por índice de falsifiers; manual (§4.3)
  closed_at     date,
  exit_price    numeric(12,4),
  fees_close    numeric(10,2) default 0,
  exit_reason   text check (exit_reason in ('sma_exit','falsifier','manual')),
  exit_note     text,                         -- qué falsador saltó / motivo manual
  paper         boolean not null default false,  -- posición de papel (§1.6)
  created_at    timestamptz default now(),
  constraint invest_positions_falsifiers_min check (array_length(falsifiers, 1) >= 2),
  constraint invest_positions_close_consistent check (
    (closed_at is null and exit_price is null and exit_reason is null)
    or (closed_at is not null and exit_price is not null and exit_reason is not null)
  )
);
create unique index invest_positions_one_open_per_ticker
  on invest_positions (user_id, ticker, paper) where closed_at is null;   -- papel y real no se bloquean (§1.6)
```
RLS: `for all using (auth.uid() = user_id)`.

### 2.4 `invest_settings` — una fila por usuario
```sql
create table if not exists invest_settings (
  user_id               uuid primary key references auth.users on delete cascade,
  total_portfolio_value numeric(14,2) not null,   -- núcleo + satélite, lo actualiza el usuario
  satellite_pct         numeric(5,4) not null default 0.20,
  max_positions         integer not null default 5,
  position_pct          numeric(5,4) not null default 0.04,
  benchmark_ticker      text not null default 'IWDA.AS',
  started_at            date,                         -- null hasta la primera posición real (§1.6)
  paper_mode            boolean not null default true, -- hasta "Start real test"
  updated_at            timestamptz default now()
);
```
RLS: `for all using (auth.uid() = user_id)`.

### 2.5 `invest_prices` — cierres mensuales ajustados (compartidos)
```sql
create table if not exists invest_prices (
  ticker     text not null,
  month_end  date not null,
  adj_close  numeric(12,4) not null,
  close      numeric(12,4),             -- sin ajustar por dividendos (§5.1); migración 20261027150000_invest_prices_close.sql
  primary key (ticker, month_end)
);
```
El job escribe aquí: el benchmark, cada ticker que tenga alguna posición (abierta o cerrada) de cualquier usuario, desde 12 meses antes de la primera apertura, y los pares `EUR{divisa}=X` (`EURUSD=X`, `EURGBP=X`, `EURCHF=X`, `EURSEK=X`, `EURDKK=X`, `EURNOK=X`: unidades de la divisa por 1 EUR) desde el inicio más antiguo de todo lo anterior. RLS: `select` para `authenticated`.

### 2.6 `invest_position_checks` — señal mensual por posición abierta
```sql
create table if not exists invest_position_checks (
  position_id  uuid references invest_positions(id) on delete cascade not null,
  run_id       uuid references invest_screen_runs(id) on delete cascade not null,
  price        numeric(12,4) not null,
  sma10m       numeric(12,4) not null,
  signal       text not null check (signal in ('hold','sell')),
  primary key (position_id, run_id)
);
```
RLS: `select using (exists (select 1 from invest_positions p where p.id = position_id and p.user_id = auth.uid()))`. Escritura solo service role.

### 2.7 Página de detalle (§4.7)
Migración `20261027170000_invest_ticker_detail.sql`.
- `invest_tickers (ticker PK, name, exchange, currency, financial_currency, sector, industry, summary, updated_at)`: ficha por ticker; `financial_currency` es la divisa de los estados financieros (puede no coincidir con la de cotización). Job, upsert. RLS `select` para `authenticated`.
- `invest_fundamentals_history (ticker, fiscal_year, revenue, gross_margin, fcf, roic, net_debt_ebitda; PK ticker + fiscal_year)`: últimos 4 años fiscales. Job, upsert. RLS `select` para `authenticated`.
- `invest_thesis_drafts (user_id, ticker, answers jsonb, updated_at; PK user_id + ticker)`: respuestas del bloque "Thesis prompts". RLS por usuario.

---

## 3. Job de screening (`scripts/screener/`)

Python, fuera de Next. Carpeta propia con `requirements.txt` (yfinance, pandas, requests), `README.md` corto, y tests con pytest.

### 3.1 Ejecución
- Workflow `.github/workflows/screener.yml`: `schedule` con cron `0 7 1-4 * *` (07:00 UTC los días 1–4) + `workflow_dispatch` con input opcional `run_date`. El script comprueba si hoy es el **primer día hábil del mes** (lunes–viernes, excluyendo festivos NYSE de una lista fija en el código) y sale sin hacer nada si no lo es. Así se evita depender de que el cron caiga en día hábil.
- `workflow_dispatch` **corre siempre** (se salta el check de primer día hábil). `run_date` vacío = último día hábil del mes anterior; si se da, debe ser el último día hábil de un mes pasado.
- Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Escribe por la REST API de Supabase (PostgREST) con la service role; no necesita el cliente oficial.
- Idempotente: si ya existe un run con ese `run_date`, **reutiliza su fila** (mismo `id`, actualiza sus campos) y borra y rehace sus resultados y checks. No se borra el run: `invest_positions.run_id` lo referencia sin `on delete cascade` y el DELETE fallaría.
- Job summary de Actions con: fecha, universo, cuántos pasan, lista de tickers aprobados, y las señales `sell` por usuario (solo recuento, sin datos personales).

### 3.2 Pasos
1. `run_date` = último día hábil del mes anterior (el cierre mensual que se evalúa).
2. Universo (§1.1). Para cada ticker, descargar con yfinance: `history(start=…, interval="1mo")` con los 36 meses que acaban en el mes del run, desde el día 1 del más antiguo (los cálculos usan 13 meses; el resto es el gráfico de 36 meses de §4.7) y `income_stmt`, `cashflow`, `balance_sheet`, `info` para fundamentales. Calcular todos los campos de §2.2.
3. Benchmark: leer `benchmark_ticker` de todas las filas de `invest_settings` (normalmente uno); descargar cierres mensuales; escribir en `invest_prices`.
4. Evaluar reglas §1.2 y §1.3 en una función pura `evaluate(row, benchmark_series) -> ScreenResult` con `fail_reasons`. **Esta función es la única implementación de las reglas en todo el proyecto**; TS no las reimplementa.
5. Insertar run + resultados.
6. Posiciones abiertas (todas las de `invest_positions` con `closed_at is null`): para cada ticker, precio y `sma10m` → `invest_position_checks` con `signal`. Escribir también sus cierres mensuales en `invest_prices`.
7. Resumen.

### 3.3 Robustez de datos
- Tickers que fallen en descarga: se registran con `fail_reasons = {'no_data'}` y `passes = false`; no se reintenta en bucle.
- Error de red (DNS, conexión, timeout, 429): **un solo reintento** por ticker tras 3 s. Si vuelve a fallar → `no_data`. yfinance se configura con `debug.hide_exceptions = False` para que un error de red en los estados financieros no se convierta en un fallo fundamental silencioso.
- Si al terminar `no_data` > **5 %** del universo, el run se **aborta sin escribir nada** y el job termina con error (el resumen lista los tickers sin datos).
- Pausa de 0,3 s entre tickers para no provocar bloqueos de Yahoo. ~600 tickers ≈ 10–15 min; aceptable en Actions.
- Fundamentales de yfinance cambian de nombre de campo con cierta frecuencia: encapsular los accesos en una función con los alias conocidos y test con fixtures JSON reales de 3 tickers (uno que pasa, uno que falla por fundamental, uno que falla por técnico).

### 3.4 Tests (pytest)
- `test_rules.py`: `evaluate()` con fixtures; cada regla con un caso que pasa y uno que falla; `null` en cualquier ratio → falla con el `fail_reason` correcto.
- `test_calendar.py`: primer día hábil del mes con fines de semana y un festivo.
- `test_technical.py`: `sma10m`, `momentum_12_1` y `rel_strength_6m` sobre series sintéticas con valores esperados calculados a mano.

---

## 4. App (Next)

### 4.1 Ruta y navegación
- `APP_URLS.INVEST = "/invest"`, entrada en `NAV_ITEMS` (label `COMMON.NAV_LABELS.INVEST = "Invest"`) con un icono nuevo en `src/lib/ui/icons/trend-icon.tsx` siguiendo el estilo de los existentes.
- Página `src/app/(dashboard)/invest/page.tsx` (Server Component) con tres pestañas por query param `?tab=screen|positions|performance`. Componentes exclusivos en `src/app/(dashboard)/invest/components/`.
- Copies en `src/constants/copies/invest/index.ts` (inglés, como el resto).
- Primera vez sin `invest_settings`: estado vacío con formulario de ajustes (§4.5). No se puede hacer nada más hasta rellenarlo.

### 4.2 Pestaña Screen
- Cabecera: fecha del último run, universo, nº que pasan, estado "run del mes en curso: sí/no".
- Tabla de los que **pasan**: ticker, nombre, precio, distancia a `sma10m` (%), momentum 12-1, RS 6m, growth, FCF margin, ROIC, net debt/EBITDA. Mono para números (DESIGN.md).
- Buscador de ticker que muestra **cualquier** ticker del run con sus ratios y `fail_reasons` en rojo. Es para responder "¿por qué no pasa X?".
- Botón "Open position" en cada fila aprobada → modal §4.4. Deshabilitado si hay 5 abiertas, el ticker ya está abierto o su sector ya tiene 2 abiertas, con el motivo en tooltip.

### 4.3 Pestaña Positions
- Abiertas: tabla con ticker (con badge **"Paper"** si `paper`), sector, fecha, entrada, acciones, importe, último precio (de `invest_prices`), P&L latente y **señal del último check** (`hold` / `sell` en badge; las filas `sell` resaltadas en `loss`).
- Cada fila (abierta o cerrada) lleva a `/invest/positions/[id]`, la página de esa posición: sus números (y la salida, si está cerrada), el gráfico, la **tesis** y los **falsadores** con su estado manual, los **checks mensuales** del job y el botón Close de las abiertas. Enlaza al detalle del ticker (`/invest/[ticker]`); los fundamentales no se repiten.
- Gráfico (lightweight-charts): velas diarias de 18 meses de `/api/invest/bars?ticker=` (Yahoo, `interval=1d`, caché 24 h, sesión obligatoria), ajustadas por dividendos como la regla. Overlays: línea del precio de entrada con su fecha; SMA de 10 cierres mensuales como línea escalonada (cambia solo a fin de mes, calculada de `invest_prices.adj_close`, no del diario); y, en abiertas, el **nivel de salida del próximo cierre** (discontinua, `text-loss`): la media de los 9 cierres mensuales anteriores, porque cierre < (S₉ + cierre) / 10 ⇔ cierre < S₉ / 9. En cerradas, en su lugar, la línea del **precio de salida** con su fecha, en el color del P&L neto realizado (el del resumen: verde, rojo o gris si es 0 o no se puede calcular). Debajo, en abiertas, texto fijo: la salida se decide al último cierre mensual y la fecha de la próxima evaluación (último día hábil NYSE del mes). Nada más en el gráfico.
- Falsadores: estado manual "sin novedad" / "revisar" (`invest_positions.falsifier_status`, acción `setFalsifierStatus`), solo en abiertas. Es una nota: no decide nada.
- Botón "Close" → modal con `exit_reason` (precargado `sma_exit` si la señal es `sell`), precio, fecha, comisiones y nota (obligatoria si `falsifier` o `manual`).
- Cerradas: tabla con P&L realizado bruto, comisiones, impuesto estimado (§5.2), motivo de salida. Las salidas `manual` llevan un marcador visible.

### 4.4 Modal Open position
Campos: ticker (fijo), fecha, precio, acciones (con el importe sugerido = `total_portfolio_value × position_pct` y el nº de acciones resultante precargado, editable), comisiones, **tesis** (textarea, mín. 200 caracteres), **falsadores** (lista dinámica, mín. 2, cada uno mín. 30 caracteres).
Server action `openInvestPosition` valida con Zod **y además** comprueba en servidor: existe run del mes en curso; el ticker está en ese run con `passes = true`; abiertas < `max_positions`; no hay otra abierta del mismo ticker; menos de 2 abiertas en el sector del ticker (§1.4). En modo papel la posición se crea con `paper = true` y el modal lo dice ("Paper position"); los límites se cuentan solo entre las abiertas del modo actual (§1.6). Cualquier fallo → error con copy claro. La regla vive en el servidor, no solo en el botón.

### 4.5 Ajustes (dentro de la pestaña Performance o modal desde cabecera)
`total_portfolio_value`, `benchmark_ticker`. `started_at` se muestra (modo papel, "Real test" pendiente de la primera posición, o fecha de inicio) pero no se edita: lo fija la primera posición real (§1.6). En modo papel, botón **"Start real test"** (con confirmación). `satellite_pct`, `max_positions` y `position_pct` se muestran pero **no son editables desde la UI** (cambiarlos es cambiar la spec; se haría por SQL a propósito).

### 4.7 Detalle de ticker `/invest/[ticker]`
Ayuda a **escribir** la tesis y los falsadores; **no decide nada** (las reglas siguen solo en `evaluate()`).
- Cabecera: nombre, sector, industria; resultado del último run (pasa / no pasa y `fail_reasons`, la misma checklist que el buscador de Screen).
- Gráfico de los últimos 36 cierres mensuales ajustados con su SMA 10 (línea de referencia visual) y, en un segundo panel, el ratio precio / benchmark (100 = primer mes). Datos de `invest_prices`: el job guarda 36 meses de **todos** los tickers evaluados y del benchmark. Sin histórico, el gráfico lo dice.
- Tabla de los 4 últimos años fiscales (ingresos, margen bruto, FCF, ROIC, deuda neta/EBITDA) con la variación interanual (%; en puntos para márgenes y ROIC), importes en `financial_currency`. Descripción del negocio plegada.
- **Thesis prompts**: cuatro preguntas fijas con un textarea cada una (de dónde viene el crecimiento; qué lo pararía; quién pierde si esta empresa gana; qué dato de los próximos dos trimestres lo confirmaría o desmentiría), con autoguardado en `invest_thesis_drafts`. El modal "Open position" precarga la tesis con las cuatro respuestas y propone como falsadores las respuestas 2 y 4; su validación no cambia.
- Cada fila de Screen enlaza al detalle (las de Positions, a `/invest/positions/[ticker]`, §4.3).
- Botón "Open position" en la cabecera, el mismo de Screen (§4.2) con el mismo bloqueo y tooltip.

### 4.6 Pestaña Performance
- "Month N of 36" desde `started_at`. Sin posiciones reales, la curva es la de las posiciones de papel (desde la primera apertura de papel) con la etiqueta **"Paper"** bien visible; con reales, solo las reales y un bloque plegado **"Paper positions"** al final.
- Gráfico de dos líneas (cierres mensuales): satélite (TWR, §5.1) vs. benchmark, ambos base 100 en `started_at`. Reutilizar el wrapper de charts existente (`src/components/charts/`); si no encaja, `lightweight-charts` que ya está en dependencias.
- Tabla: rentabilidad acumulada satélite bruta, neta de comisiones, neta de impuestos estimados; benchmark; diferencia. Nº de operaciones, nº de salidas por motivo, % de meses con revisión hecha (hubo run y el usuario entró a Screen con ese run vigente → una fila en `invest_reviews (user_id, run_id, reviewed_at)`, PK compuesta, insertada por `markRunReviewed` al visitar Screen).

---

## 5. Cálculos (`src/lib/calculations/invest-*.ts`, puros, con vitest)

**Divisa base EUR.** `total_portfolio_value`, comisiones, rentabilidades e impuestos van en EUR. `entry_price`/`exit_price` se registran en la divisa de cotización del ticker (`invest_screen_results.currency`; `GBp` en peniques). Un importe en divisa `C` pasa a EUR dividiendo por el cierre mensual de `EUR{C}=X` (y por 100 si es `GBp`): las posiciones, al cierre de cada mes; aperturas y cierres, al cierre del mes en que ocurren (todo es cierre mensual, §9). El benchmark (IWDA.AS) ya cotiza en EUR.

### 5.1 `invest-performance.ts`
- `satelliteMonthlyReturns(positions, prices, settings)`: el satélite arranca en `started_at` como caja = `total_portfolio_value × satellite_pct`. Valor a fin de cada mes `V = caja + Σ valor de las posiciones abiertas`. **Total return implícito; dividendos cobrados no se registran**: una posición vale `acciones × close(mes de apertura) × adj_close(m) / adj_close(mes de apertura)`, tanto abierta como al cerrarse. El primer tramo (compra → primer cierre mensual) va con el cierre real sin ajustar (`invest_prices.close`); desde ahí manda la serie ajustada, que incluye los dividendos igual que el benchmark de acumulación. El precio real de salida se mantiene para el P&L realizado y el impuesto. La pestaña Positions, en cambio, muestra el P&L latente como `acciones × último close − coste real` ("lo que tendría si vendiera hoy"), así que puede diferir de Performance; la cabecera de Performance lo indica. Abrir resta de la caja `precio × acciones` (+ comisión) y cerrar suma el valor a total return de la posición (− comisión): son movimientos internos, no hay flujos externos, así que la rentabilidad mensual es `V_end / V_start − 1`. La caja sin invertir rinde 0. Tres series: `gross` (sin comisiones ni impuestos), `netFees` (con comisiones) y `netTax` (con comisiones y el impuesto estimado de §5.2: tras cada cierre se recalcula el impuesto del año en curso y se resta la diferencia en ese mes; una pérdida posterior del mismo año lo devuelve). Devuelve `{ monthEnd, gross, netFees, netTax }[]`.
- `benchmarkMonthlyReturns(prices, ticker, from)`.
- `chainReturns(returns)` → índice base 100.
- Tests con un caso de 6 meses calculado a mano, con una apertura, un cierre y un mes sin movimientos.

### 5.2 `invest-tax.ts`
- `estimateSpanishCapitalGainsTax(realizedGainsByYear)`: tramos 19 % (≤ 6.000), 21 % (≤ 50.000), 23 % (≤ 200.000), 27 % (≤ 300.000) y 28 % (resto), aplicados sobre la ganancia neta anual en EUR (las pérdidas del año compensan; no se arrastran entre años). Etiquetar en UI como estimación. Tests por tramo y con pérdidas que compensan.

### 5.3 `invest-sizing.ts`
- `suggestedPositionSize(settings, price)` → `{ amount, shares }` con `shares = floor(amount / price)`. `amount` en EUR; el precio se pasa a EUR con el FX del mes del run (§5).

---

## 6. Queries, mappers, actions (convenciones del repo)
- `src/types/invest.ts`: schemas Zod (`investSettingsSchema`, `investPositionSchema`, `screenRunSchema`, `screenResultSchema`, `positionCheckSchema`) e inputs de actions.
- `src/services/mappers/invest.ts`: `mapXFromDb` con `schema.parse`.
- `src/services/queries/invest.ts`: `getLatestRun()`, `getScreenResults(runId, { passesOnly })`, `getScreenResult(runId, ticker)`, `getPositions(userId)`, `getInvestSettings()`, `getPricesFor(tickers, from)`, `getPerformance()`.
- `src/actions/invest.ts`: `saveInvestSettings`, `openInvestPosition`, `closeInvestPosition`, `markRunReviewed`. Todas devuelven `ResultType` y muestran toast en cliente.

---

## 7. Orden de implementación
1. Migración + rollback + `schema.sql`.
2. Job Python con tests; correrlo a mano con `workflow_dispatch` contra Supabase y comprobar filas.
3. Tipos, mappers, queries, cálculos con tests.
4. Pestaña Screen (lectura).
5. Ajustes + modal Open position + action con validaciones de servidor.
6. Pestaña Positions + Close.
7. Pestaña Performance.
8. Actualizar `CLAUDE.md` con una sección "Invest" que resuma reglas (§1), tablas y job.

Commit por paso. Lint, `npm test` y `pytest` en verde antes de cada commit. Añadir `pytest` al workflow `ci.yml` (job separado con Python 3.12, solo si cambian archivos bajo `scripts/screener/`).

---

## 8. Variables y secretos
- Vercel: nada nuevo (la app solo lee tablas con el cliente de usuario y RLS).
- GitHub Actions secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Documentar en `scripts/screener/README.md` y en `.env.example` como comentario (sin valores).

---

## 9. Fuera de alcance (no hacer aunque parezca fácil)
- Backtest del screener. Sin datos point-in-time es un número falso; el test es el forward de 36 meses.
- Alertas por email/push. El usuario entra una vez al mes; la señal está en la app.
- Cotizaciones intradía o diarias en el módulo. Todo es cierre mensual.
- Parámetros editables (umbrales, lookbacks, nº de posiciones). Cambiarlos es cambiar la spec.
- Integración con bróker o importación de operaciones. Se registran a mano: son ≤ 5 al mes.
- Cortos, apalancamiento, opciones.

---

## Later

Ideas surgidas durante la implementación que **no** se hacen ahora (nada de esto está construido):

Nada pendiente por ahora.

---

## 10. Registro de decisiones

| Fecha | § | Decisión |
|---|---|---|
| 2026-10-27 | 3.1 | Rerun del mismo `run_date`: se reutiliza la fila del run y se rehacen resultados y checks (no se borra el run). |
| 2026-10-27 | 1.2 | Denominador ≤ 0 → ratio `null` → falla. La caja neta pasa la regla de deuda aunque el EBITDA falte o sea negativo. |
| 2026-10-27 | 1.1 | Market cap convertido a USD con FX de Yahoo a `run_date`; `GBp` usa el par GBP. Sin FX → `null` → falla. |
| 2026-10-27 | 3.1 | `workflow_dispatch` corre siempre; `run_date` por defecto = último día hábil del mes anterior. |
| 2026-10-27 | 1.2 | `TotalDebt` ausente/NaN en un balance que sí cargó = 0; solo `null` si falta el balance entero. |
| 2026-10-27 | 3.3 | Un reintento por ticker tras 3 s en error de red; `no_data` > 5 % del universo aborta el run sin escribir y el job termina con error. |
| 2026-10-27 | 1.1 | `market_cap` = `Close[t]` × `impliedSharesOutstanding` × FX a `run_date` (`GBp` / 100). `info.marketCap` venía al precio del día de ejecución (MU en el run de 2026-09-30: 1,022e12 guardado vs. 1,205e12 al cierre del 30/09). `sharesOutstanding` descartado: solo cuenta una clase (GOOGL ×0,48, RO.SW ×0,13). |
| 2026-10-27 | 1.3 | Revisado con MU: price, `sma10m` y los dos extremos del momentum 12-1 salen todos de `Adj Close` (y el benchmark también); no hay mezcla de ajustados y sin ajustar. |
| 2026-10-27 | 1.4 | Máximo 2 posiciones abiertas por sector (`invest_screen_results.sector`). Sector null cuenta como un sector más. Se valida en `openInvestPosition`. |
| 2026-10-27 | 2.2 / 2.5 | `invest_screen_results.currency` (divisa de `price`) y pares `EUR{divisa}=X` en `invest_prices`, para valorar en EUR. |
| 2026-10-27 | 5 | Divisa base EUR: posiciones, aperturas y cierres se pasan a EUR con el cierre mensual del par; comisiones en EUR. |
| 2026-10-27 | 5.1 | TWR con caja + posiciones: aperturas y cierres son movimientos internos (sin flujos externos), `r = V_end / V_start − 1`; la caja sin invertir rinde 0. `netTax` resta el impuesto en el mes de cada cierre (recalculado sobre el año en curso). |
| 2026-10-27 | 5.2 | Tramos por encima de 200.000 €: 27 % hasta 300.000 y 28 % el resto (ley vigente). |
| 2026-10-27 | 4.4 | `openInvestPosition` exige además `run_date < opened_at ≤ hoy` (se decide con el run del mes, sin fechas futuras). Las reglas de bloqueo (run del mes, aprobado, máx. posiciones, ticker abierto, sector) viven en `openBlockers()` y las comparten el botón y la action. |
| 2026-10-27 | 4.3 | Impuesto estimado por posición cerrada = lo que su cierre añade al impuesto de su año (cierres en orden cronológico; negativo si una pérdida devuelve). Mismo criterio que `netTax`. |
| 2026-10-27 | 4.3 | En la pestaña Positions, un importe de un mes cuyo cierre de FX aún no existe usa el último cierre del par anterior (solo para mostrar; el rendimiento de §5.1 valora cada mes con su propio cierre). `closeInvestPosition` exige `opened_at ≤ closed_at ≤ hoy`. |
| 2026-10-27 | 4.6 | Revisiones en `invest_reviews (user_id, run_id, reviewed_at)` (migración `20261027140000_invest_reviews.sql`), insertadas al visitar Screen con el run vigente. Se elimina `invest_settings.last_reviewed_run_id`, que no guardaba histórico. |
| 2026-10-27 | 5.1 | Total return implícito: abiertas y cerradas se valoran con `coste de entrada × adj_close(m) / adj_close(mes de apertura)`; dividendos cobrados no se registran. El precio real de salida solo cuenta para P&L realizado e impuesto. |
| 2026-10-27 | 1.6 | `started_at` se fija al abrir la primera posición con dinero real (`openInvestPosition` lo pone a su `opened_at`); hasta entonces es modo papel. Deja de ser editable en ajustes (§4.5). |
| 2026-10-27 | 2.5 / 5.1 | `invest_prices.close` (cierre sin ajustar, migración `20261027150000_invest_prices_close.sql`). Performance: `acciones × close(apertura) × adj(m) / adj(apertura)`, el primer tramo deja de ser 0. Positions: P&L latente = `acciones × último close − coste real`. Filas sin `close` (anteriores al job nuevo): la serie de Performance se corta y Positions no muestra último precio hasta que el job las reescriba. |
| 2026-10-27 | 1.6 / 4.4 | Posiciones de papel (`invest_positions.paper`, migración `20261027160000_invest_paper.sql`): en modo papel (`invest_settings.paper_mode`) el modal las abre con las mismas validaciones y checks. "Start real test" en ajustes sale del modo papel; `started_at` (ahora nullable) lo fija solo la primera posición real. En modo real las de papel abiertas no cuentan para los límites (índice único por `user_id, ticker, paper`). Performance: curva de papel etiquetada sin reales; con reales, solo reales + bloque "Paper positions". |
| 2026-10-27 | 4.7 | Página de detalle `/invest/[ticker]` con `invest_tickers`, `invest_fundamentals_history` e `invest_thesis_drafts` (migración `20261027170000_invest_ticker_detail.sql`). El job descarga 3 años (antes 2) y guarda 36 meses de cierres de todos los tickers evaluados y del benchmark; la historia de 4 años se calcula una vez por ticker y run reutilizando las funciones de `fundamentals.py` sin tocar `evaluate()`. `months_listed` pasa a contar sobre 3 años (máx. ~36; el umbral de 12 no cambia ningún resultado). Importes en `financial_currency`. Borradores con autoguardado. |
| 2026-10-28 | 4.3 / 4.7 | Positions: las abiertas pasan de tarjetas a tabla; tesis y falsadores salen de la lista y viven en `/invest/positions/[ticker]` (todas las posiciones del ticker). `/invest/[ticker]` tiene el botón "Open position" de Screen en la cabecera, que precarga la tesis con lo escrito en Thesis prompts aunque no se haya guardado. |
| 2026-10-28 | 3.2 | Precios con `start` = día 1 del mes `run_date − 35 meses` en vez de `period="3y"`: "3 años desde hoy" dejaba fuera el primer mes (35 cierres en el run de 2026-09-30) y en un rerun de un `run_date` antiguo aún menos. `months_listed` llega a 36; el umbral de 12 no cambia. |
| 2026-10-28 | Later (shell) | Hechas las tres ideas del shell: el último módulo pasa a la cookie `active_module` y las rutas compartidas (`/settings`) lo mantienen; `/` y el login con sesión van al home de ese módulo desde el middleware (se elimina `root-redirect.client.tsx`); las rutas de Trading pasan al route group `(dashboard)/(trading)/`, cuyo layout es el único que pide las alertas de prop firm. |
| 2026-10-28 | 4.3 | Página por posición `/invest/positions/[id]` (sustituye a `/invest/positions/[ticker]`): gráfico diario de 18 meses (`/api/invest/bars`, Yahoo, caché 24 h) con entrada, SMA 10 mensual escalonada y nivel de salida del próximo cierre (media de los 9 cierres anteriores), o el precio de salida en el color del P&L realizado en las cerradas; tesis y falsadores con estado manual (`invest_positions.falsifier_status`, migración `20261028120000_invest_falsifier_status.sql`); checks mensuales; cierre. Velas ajustadas por dividendos para compararlas con la SMA sobre `adj_close`. Calendario NYSE copiado a TS (`invest-calendar.ts`), con un test que lo compara con el del job. |
