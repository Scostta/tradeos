# CLAUDE.md — Trading Journal MVP

## Descripción del proyecto

Aplicación web de diario y tracking de trading estilo Tradezella, orientada a traders de futuros (NQ/ES). Permite importar trades desde NinjaTrader vía CSV, visualizar métricas de rendimiento y gestionar estrategias y journal diario.

Un usuario puede tener **múltiples cuentas de trading**. Las cuentas se crean automáticamente al importar un CSV de NinjaTrader — el parser detecta la columna `Account` y hace upsert de la cuenta si no existe — o al llegar el primer trade del add-on de NinjaTrader (ver *Sincronización NinjaTrader*). No hay paso de creación manual obligatorio. Toda la app filtra por la cuenta activa seleccionada en el selector global del sidebar.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 14 (App Router) |
| Base de datos | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Estilos | Tailwind CSS + shadcn/ui |
| Charts | Recharts |
| Lenguaje | TypeScript |

---

## Estructura de carpetas

```
/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx          # Sidebar + nav + selector de cuenta
│   │   ├── dashboard/page.tsx
│   │   ├── trades/
│   │   │   ├── page.tsx        # Tabla de todos los trades
│   │   │   └── [id]/page.tsx   # Trade View detallado
│   │   ├── import/page.tsx     # Upload CSV NinjaTrader
│   │   ├── reports/page.tsx
│   │   ├── strategies/page.tsx
│   │   ├── journal/page.tsx
│   │   └── accounts/page.tsx   # Ajustes de cuentas (editar nombre, color, tipo, balance)
│   └── api/
│       └── import/route.ts     # Parseo CSV → Supabase
├── components/
│   ├── ui/                     # shadcn components
│   ├── dashboard/              # Widgets de métricas
│   ├── charts/                 # Wrappers de Recharts
│   └── trades/                 # Tabla, filtros, trade card
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # Browser client
│   │   └── server.ts           # Server client
│   ├── parsers/
│   │   └── ninjatrader.ts      # Parser CSV NinjaTrader
│   └── calculations/
│       └── metrics.ts          # P&L, WinRate, PF, DD...
├── types/
│   └── index.ts                # Trade, Strategy, JournalEntry...
└── supabase/
    └── schema.sql              # Schema completo con RLS
```

---

## Schema de base de datos (Supabase)

### Tabla `accounts`

Las cuentas se crean automáticamente desde el parser al importar un CSV. El usuario puede editarlas después desde `/accounts` para enriquecerlas (color, tipo, balance inicial). No hay creación manual en el onboarding.

```sql
create table accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,                -- viene directo del campo "Account" del CSV de NinjaTrader
  broker text,                       -- editable por el usuario después del import
  account_type text check (account_type in ('real', 'funded', 'demo', 'paper')) default 'real',
  currency text default 'USD',
  initial_balance numeric(12,2),     -- editable por el usuario; usado para calcular DD sobre cuenta
  active boolean default true,
  color text default '#3b82f6',      -- color identificador en la UI (hex), editable
  notes text,
  created_at timestamptz default now(),
  unique(user_id, name)              -- ⬅️ constraint para el upsert del parser
);

alter table accounts enable row level security;
create policy "Users see own accounts" on accounts
  for all using (auth.uid() = user_id);
```

### Tabla `trades`

```sql
create table trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  account_id uuid references accounts(id) on delete cascade not null,  -- ⬅️ FK a accounts
  instrument text not null,              -- 'NQ', 'ES', etc.
  direction text check (direction in ('long', 'short')) not null,
  contracts integer not null,
  entry_price numeric(12,4) not null,
  exit_price numeric(12,4) not null,
  entry_time timestamptz not null,
  exit_time timestamptz not null,
  pnl numeric(10,2) not null,            -- bruto
  commission numeric(8,2) default 0,
  net_pnl numeric(10,2) not null,        -- pnl - commission
  mae numeric(10,2),                     -- Max Adverse Excursion
  mfe numeric(10,2),                     -- Max Favorable Excursion
  strategy_id uuid references strategies(id) on delete set null,
  session text check (session in ('RTH', 'ETH', 'overnight')),
  notes text,
  tags text[],
  created_at timestamptz default now()
);

-- Dedupe del import por huella del trade (src/helpers/trade-fingerprint.ts):
-- import_key = instrument|direction|contracts|entry epoch|exit epoch|entry price|exit price#n
-- NO usar trade_number: NinjaTrader lo reinicia en 1 en cada export.
create unique index trades_import_key_unique
  on trades (account_id, import_key);

alter table trades enable row level security;
create policy "Users see own trades" on trades
  for all using (auth.uid() = user_id);
```

### Tabla `strategies`

```sql
create table strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  -- Las estrategias son globales por usuario, no por cuenta
  -- Se pueden aplicar a trades de cualquier cuenta
  name text not null,
  description text,
  rules text,
  active boolean default true,
  created_at timestamptz default now()
);

alter table strategies enable row level security;
create policy "Users see own strategies" on strategies
  for all using (auth.uid() = user_id);
```

### Tabla `daily_journal`

El journal es **global por usuario**, no por cuenta. Una entrada por día agrupa el estado mental y el plan del trader independientemente de en qué cuenta haya operado. El calendario del journal **no** se filtra por la cuenta activa.

```sql
create table daily_journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  -- Sin account_id: el journal es por usuario, no por cuenta
  date date not null,
  pre_market_notes text,
  post_market_notes text,
  mood integer check (mood between 1 and 5),
  followed_plan boolean,
  created_at timestamptz default now(),
  unique(user_id, date)   -- ⬅️ unicidad por usuario + día
);

alter table daily_journal enable row level security;
create policy "Users see own journal" on daily_journal
  for all using (auth.uid() = user_id);
```

### Diagrama de relaciones

```
auth.users
    │
    ├──< accounts (user_id)
    │        │
    │        └──< trades (account_id)
    │                 └──> strategies (strategy_id)  [opcional]
    │
    ├──< daily_journal (user_id)   [global por usuario, sin cuenta]
    │
    └──< strategies (user_id)      [globales, sin cuenta]
```

---

## Parser CSV de NinjaTrader

El CSV de NinjaTrader (exportado desde Trade Performance → Export) tiene este formato:

```
Trade #,Account,Instrument,Market pos.,Quantity,Entry price,Exit price,Entry time,Exit time,Profit,Commission,MAE,MFE
1,Sim101,NQ 03-25,Long,1,19850.00,19875.00,3/10/2025 9:32:01 AM,3/10/2025 9:45:22 AM,500.00,8.50,-120.00,620.00
```

El parser vive en `lib/parsers/ninjatrader.ts` y debe:
1. Parsear las columnas arriba indicadas
2. **Detectar automáticamente las cuentas** — extraer los valores únicos de la columna `Account`
3. Para cada cuenta detectada: hacer **upsert** en la tabla `accounts` usando `(user_id, name)` como constraint. Si ya existe, no sobreescribir campos que el usuario haya editado (color, tipo, balance inicial). Si es nueva, crearla con valores por defecto.
4. Normalizar `Market pos.` → `long | short`
5. Extraer el símbolo limpio del instrumento (`NQ 03-25` → `NQ`)
6. Calcular `net_pnl = profit - commission`
7. Convertir fechas al formato ISO 8601
8. Hacer upsert de trades en Supabase evitando duplicados por `(account_id, import_key)` (ver `withImportKeys()`)
9. Ignorar filas sin `Exit time` (trades parcialmente cerrados)

### Lógica de upsert de cuentas en el parser

```typescript
// Para cada account_name único encontrado en el CSV:
const { data: account } = await supabase
  .from('accounts')
  .upsert(
    { user_id, name: account_name },
    { onConflict: 'user_id,name', ignoreDuplicates: true }
  )
  .select('id')
  .single()

// ignoreDuplicates: true → si ya existe, NO sobreescribe color/tipo/balance_inicial
// que el usuario haya configurado manualmente
```

---

## Cálculo de métricas (lib/calculations/metrics.ts)

```typescript
// Todas las funciones reciben Trade[] (ya filtrados por account_id) y devuelven número

totalNetPnL(trades)                    // suma de net_pnl
winRate(trades)                        // % trades con net_pnl > 0
profitFactor(trades)                   // suma ganancias / abs(suma pérdidas)
maxDrawdown(trades, initialBalance?)   // caída máxima desde equity peak
                                       // si se pasa initialBalance, el DD es sobre la cuenta
avgWin(trades)                         // media net_pnl de trades ganadores
avgLoss(trades)                        // media net_pnl de trades perdedores
equityCurve(trades, initialBalance?)   // array acumulado para el chart
pnlByDayOfWeek(trades)                 // { Mon: X, Tue: Y, ... }
pnlByHour(trades)                      // { 9: X, 10: Y, ... }
pnlByStrategy(trades)                  // { strategyName: X, ... }
pnlByAccount(trades, accounts)         // { accountName: X, ... }  ⬅️ para vista multi-cuenta
```

> **Importante**: los datos siempre se filtran por `account_id` antes de llegar a estas funciones. El contexto de cuenta activa se gestiona con un React Context (`AccountContext`) que provee el `account_id` seleccionado a toda la app.

---

## Páginas y componentes clave

### Selector de cuenta global (en el Sidebar)

- Dropdown en la parte superior del sidebar con todas las cuentas del usuario.
- Opción especial **"Todas las cuentas"** que agrega métricas de todas.
- La cuenta seleccionada se guarda en `AccountContext` (React Context) y en `localStorage` para persistir entre sesiones.
- Cada cuenta muestra su color identificador como dot de color.
- Acceso rápido a "Ajustes de cuentas" → `/accounts`.

### `/accounts` — Ajustes de cuentas *(no es CRUD, es enriquecimiento)*
- Grid de cards, una por cuenta. Las cuentas existen porque se importaron — no se crean aquí.
- Cada card: nombre (read-only, viene del CSV), broker, tipo (badge: Real / Funded / Demo / Paper), balance inicial, color, estado (activa/inactiva).
- Stats rápidas en cada card: total trades, net P&L acumulado.
- Edición inline o modal: broker, tipo, balance inicial, color (color picker), notas.
- Archivar cuenta (soft delete: `active = false`). **No se permite eliminar** si tiene trades.
- **No hay botón "Nueva cuenta"** — las cuentas solo se crean vía import.

### `/dashboard`
- Selector de cuenta visible en el header de la página (refleja el global del sidebar).
- Cards: Net P&L (día/semana/mes/total), Win Rate, Profit Factor, Max Drawdown, Avg Win, Avg Loss
- Equity curve (LineChart de Recharts) — si "Todas las cuentas", muestra una línea por cuenta con su color.
- Últimos 5 trades (con columna de cuenta si vista agregada).
- Filtro de rango de fechas global.

### `/trades`
- Tabla paginada con columnas: Fecha, Instrumento, Dirección, Contratos, Entry, Exit, P&L neto, Estrategia, **Cuenta** (badge con color si vista agregada).
- Filtros: instrumento, dirección, estrategia, rango fechas, **cuenta** (si vista agregada).
- Click en fila → `/trades/[id]`

### `/trades/[id]`
- Todos los campos del trade, incluyendo la cuenta a la que pertenece.
- MAE/MFE como mini bar chart.
- Notas editables inline.
- Asignar estrategia.

### `/import`
- Drag & drop del CSV de NinjaTrader. No requiere selección previa de cuenta.
- Tras parsear el CSV, se muestra un **resumen de cuentas detectadas** en el archivo (ej. "Se encontraron 2 cuentas: Sim101, Live42"). Cuentas nuevas marcadas como "Nueva ✦", existentes como "Existente".
- Preview de los trades parseados en tabla (agrupados o filtrables por cuenta).
- Indicador de duplicados detectados por cuenta.
- Botón "Importar X trades" — ejecuta el upsert de cuentas y trades en una sola operación.

### `/reports`
- P&L por día de la semana (BarChart).
- P&L por hora del día (BarChart).
- P&L por estrategia (BarChart).
- **P&L por cuenta** (BarChart) — visible solo en vista "Todas las cuentas".
- Tabla de estadísticas por instrumento.

### `/strategies`
- Lista de estrategias con stats agregadas (trades, win rate, P&L) — globales, no por cuenta.
- CRUD: crear / editar / archivar.

### `/journal`
- Calendario mensual con color por P&L del día (verde/rojo/gris). El journal es global por usuario: el P&L del día agrega los trades de **todas** las cuentas, no se filtra por la cuenta activa.
- Click en día → abre drawer con notas pre/post mercado, mood, trades del día.

---

## Sincronización NinjaTrader (add-on)

- `public/downloads/TradeOSSync.cs` — AddOn de NT8 (C# 5, sin dependencias). Por cada posición cerrada (flat → flat) manda los trades emparejados FIFO por ejecución, el stop inicial, MAE/MFE y una captura PNG del chart. Cola en disco + reintentos.
- `POST /api/ingest/ninjatrader` — auth `Bearer tos_...` (tabla `api_tokens`, solo se guarda el sha256). Sin sesión: usa el service-role client filtrando siempre por el `user_id` del token. Es pública en el proxy (`src/proxy.ts`, `APP_URLS.INGEST_PREFIX`).
- Dedupe con la misma huella que el CSV (`withImportKeys()`), respeta `import_exclusions`. Los trades entran con `source = 'sync'`. La captura se recodifica a WebP (`lib/images/compress-screenshot.ts`) y solo se adjunta a trades recién insertados.
- Tokens y descarga de `tradeos.json` en `/settings` → NinjaTrader sync.

## Shell de módulos

TradeOS son tres **módulos** que comparten login, diseño (DESIGN.md), layout `(dashboard)` y despliegue: **Trading** (el diario de futuros: `/dashboard`, `/trades`, `/import`, `/reports`, …), **Invest** (núcleo/satélite con screener mensual, ver `INVEST_SPEC.md`: `/invest`, `/invest/positions`, `/invest/performance`) y **Money** (finanzas personales: `/money`).

- El módulo de una ruta se deriva del pathname con `getRouteModule(pathname)` (`src/helpers/active-module.ts`): `/invest…` → invest, `/money…` → money, rutas compartidas (`/settings`) → `null`, todo lo demás → trading. En las compartidas el shell muestra el **último módulo visitado** (`useActiveModule`, `src/hooks/use-active-module.ts`).
- El sidebar muestra el conmutador Trading / Invest / Money bajo la marca (en móvil, dentro del drawer) y la navegación de ese módulo (`NAV_BY_MODULE` en `sidebar.client.tsx`). Cambiar de módulo navega a su home (`MODULE_HOME`). Settings vive en el footer y es compartido.
- El último módulo visitado se guarda en la cookie `active_module` (`rememberModule`). La leen el proxy (`src/proxy.ts`; `/` y el login con sesión van al home de ese módulo; tras login/registro las actions redirigen a `/`) y el layout `(dashboard)` (módulo inicial del sidebar en rutas compartidas).
- Cada home de módulo tiene su propia cabecera con título y subtítulo; no hay TopBar global.
- **Trading es el único módulo con selector de cuenta** (`AccountSelector` en las cabeceras de sus páginas, `?account=`) y con el banner de alertas de prop firm: sus rutas viven en el route group `src/app/(dashboard)/(trading)/` (no cambia las URLs), cuyo layout es el único que pide las alertas.
- **Cada módulo es dueño de sus tablas y no importa de los otros.** Invest usa el prefijo `invest_*` y Money `finance_*`; las tablas sin prefijo (`trades`, `accounts`, `playbooks`, …) son de Trading. El código de un módulo (rutas, componentes, queries, actions, cálculos, copies) no importa nada de otro módulo; lo compartido (shell, `src/components/`, `src/lib/ui/`, helpers genéricos) no pertenece a ninguno.
- Futuro: una vista **"Net worth"** en Money leerá de los tres módulos (saldos de cuentas de Trading, satélite de Invest, finanzas de Money) **sin escribir en ninguno**. Es la única excepción prevista a la regla de no importar entre módulos, y es de solo lectura.

## Invest

Módulo núcleo/satélite (hipótesis 13): el núcleo es un fondo indexado fuera de la app (solo se registra su benchmark) y el satélite son ≤ 5 acciones elegidas una vez al mes con un screener de reglas fijas. Forward test de 36 meses, satélite vs. benchmark neto de impuestos. La fuente de verdad es **`INVEST_SPEC.md`**: reglas (§1), schema (§2), job (§3), app (§4), cálculos (§5), lista **Later** (ideas aparcadas: no se construyen sin pasar por ahí) y **§10 Registro de decisiones** (cada cambio de criterio se anota ahí).

### Reglas (§1, fijas)

- **Universo**: S&P 500 (Wikipedia) + `scripts/screener/universe_extra.csv`. Market cap > 2.000 M USD **al cierre de `run_date`** = `Close[t] × impliedSharesOutstanding × FX[t]` (no `info.marketCap`, no `sharesOutstanding`). ≥ 12 meses cotizando.
- **Fundamental** (todas): crecimiento de ingresos > 10 %, FCF margin > 0, margen bruto ≥ el del año anterior − 1 pt, deuda neta/EBITDA < 2 o caja neta, ROIC > 10 %. Un ratio no calculable (`null`) **falla**; `TotalDebt` ausente en un balance que sí cargó cuenta como 0.
- **Técnico** (sobre `Adj Close` mensual): precio > SMA 10 meses, momentum 12-1 > 0, fuerza relativa 6 m vs. benchmark > 0.
- **Ejecución**: solo con el run del mes en curso; máx. 5 posiciones abiertas y **máx. 2 por sector**; tamaño 4 % del patrimonio total; nunca promediar a la baja; salida mecánica `sma_exit` si `price < sma10m`; ≥ 2 falsadores por tesis; cierre `manual` = desviación.
- **Evaluación**: 36 meses desde `started_at`, que se fija al abrir la **primera posición real** (`paper = false`). Antes, **modo papel** (`invest_settings.paper_mode`): el modal abre posiciones de papel con las mismas validaciones y checks, que nunca cuentan para el test; "Start real test" en ajustes sale del modo papel, y desde ahí las de papel abiertas no cuentan para los límites. Si el satélite no bate al benchmark, se liquida.

**Las reglas de §1.1–§1.3 se implementan una sola vez, en `evaluate()` de `scripts/screener/screener/rules.py`. TS no las reimplementa**: la app solo lee `invest_screen_results` (valores, `passes`, `fail_reasons`). Lo único que valida la app son los límites de apertura de §1.4, en `openBlockers()` (`src/lib/calculations/invest-run.ts`), compartida por el botón y por `openInvestPosition`.

### Tablas (prefijo `invest_*`, migraciones `supabase/migrations/20261027*_invest*.sql` con rollback en `supabase/rollbacks/`)

| Tabla | Quién escribe | Contenido |
|---|---|---|
| `invest_screen_runs` | job (service role) | un run por cierre mensual (`run_date` único); un rerun reutiliza la fila |
| `invest_screen_results` | job | **todos** los tickers evaluados, con ratios, `sector`, `currency`, `passes` y `fail_reasons` |
| `invest_prices` | job | cierres mensuales `adj_close` y `close` (sin ajustar): 36 meses de todo el universo evaluado y del benchmark, tickers con posición y pares `EUR{divisa}=X` |
| `invest_position_checks` | job | señal `hold`/`sell` mensual por posición abierta |
| `invest_positions` | usuario (RLS) | posiciones con tesis, falsadores, cierre y motivo; `paper` para las de papel |
| `invest_settings` | usuario (RLS) | patrimonio total, benchmark, `paper_mode`, `started_at` (null hasta la primera posición real); `satellite_pct`, `max_positions`, `position_pct` no se editan desde la UI |
| `invest_reviews` | usuario (RLS) | una fila por run revisado (visita a Screen con el run vigente) |
| `invest_tickers` | job | ficha del ticker (sector, industria, resumen del negocio, divisas) para `/invest/[ticker]` |
| `invest_fundamentals_history` | job | 4 últimos años fiscales de ingresos, margen bruto, FCF, ROIC y deuda neta/EBITDA |
| `invest_thesis_drafts` | usuario (RLS) | respuestas de "Thesis prompts" por ticker (autoguardado) |

Las cuatro primeras son compartidas: `select` para `authenticated`, sin políticas de escritura.

### Job (`scripts/screener/`, Python 3.12)

- `.github/workflows/screener.yml`: cron `0 7 1-4 * *` (solo trabaja el primer día hábil NYSE) + `workflow_dispatch` (corre siempre; `run_date` opcional). Secrets `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`; escribe por PostgREST con una conexión nueva por petición.
- yfinance con `hide_exceptions = False`; un reintento a los 3 s por error de red; `no_data` > 5 % del universo **aborta sin escribir**. Si un campo de yfinance no existe con los alias conocidos (`FIELD_ALIASES`), el ratio queda `null` y falla: sin fallbacks silenciosos.
- Tests con pytest y fixtures reales (`tests/fixtures/`); en CI (`ci.yml`, job `screener-tests`) solo si cambia `scripts/screener/**`. Detalle en `scripts/screener/README.md`.

### App

- Rutas: `/invest` (Screen), `/invest/positions` (tablas de abiertas y cerradas), `/invest/positions/[ticker]` (posiciones del ticker con tesis y falsadores), `/invest/performance` y `/invest/[ticker]` (detalle: ayuda a escribir la tesis y abre posición, no decide nada). Sin `invest_settings`, solo el formulario de ajustes.
- `src/types/invest.ts` (Zod), `src/services/mappers/invest.ts`, `src/services/queries/invest.ts`, `src/actions/invest.ts` (`saveInvestSettings`, `openInvestPosition`, `closeInvestPosition`, `markRunReviewed`, `startRealTest`), cálculos puros con vitest en `src/lib/calculations/invest-*.ts`, copies en `src/constants/copies/invest/`.
- **Divisa base EUR**: precios en la divisa de cotización (`GBp` en peniques), pasados a EUR con los pares de `invest_prices`; comisiones en EUR.
- **Performance** (§5.1): TWR con caja + posiciones (abrir/cerrar son movimientos internos), **total return implícito** `acciones × close(apertura) × adj(m) / adj(apertura)`; dividendos cobrados no se registran. **Positions** muestra el P&L latente con el último `close` real ("si vendiera hoy"), por eso puede diferir.
- **Impuesto estimado** (§5.2): IRPF del ahorro 19–28 % por año, pérdidas del año compensan, sin arrastre; cada cierre se lleva lo que añade al impuesto de su año. Siempre etiquetado como estimación.

## Variables de entorno requeridas

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # solo para API routes
```

---

## Estructura de componentes

- **`src/components/`** — solo componentes verdaderamente compartidos entre **más de una página** (ej. `Sidebar`, `TopBar`, futuros `TradeRow`, `MetricCard`).
- **`src/app/(dashboard)/[ruta]/components/`** — componentes exclusivos de esa ruta (las de Trading están en `src/app/(dashboard)/(trading)/[ruta]/`). Si un componente solo se usa en `/import`, vive en `src/app/(dashboard)/(trading)/import/components/`, no en `src/components/`.
- La regla es: si solo hay un consumidor, el componente va junto a su página. Si hay más de uno, se promueve a `src/components/`.

---

## Convenciones de código

- **Componentes**: PascalCase, un componente por archivo
- **Hooks**: `use` prefix, en `/hooks/`
- **Server Components** por defecto; `"use client"` solo cuando haya estado o interactividad
- **Tipos**: definidos en `types/index.ts`, no usar `any`
- **Errores**: siempre manejar errores de Supabase y mostrar toast al usuario
- **Fechas**: usar `date-fns` para formateo, siempre UTC internamente
- **Tailwind — sin valores arbitrarios `[Xpx]`**: nunca usar clases como `w-[480px]`, `min-h-[200px]`, `mt-[18px]`. Usar siempre la escala de Tailwind (`w-48`, `min-h-48`, `mt-4.5`…). Para tamaños fijos sin equivalente en la escala (ej. ancho exacto de un modal), usar `style={{ width: 480 }}`. Para sombras complejas sin utilidad Tailwind equivalente, usar `style={{ boxShadow: "..." }}`.
- **Carpetas de código**:
  - `src/actions/` — Server Actions (`"use server"`), mutaciones llamadas desde componentes cliente
  - `src/services/queries/` — funciones de fetch para Server Components (sin `"use server"`)
  - `src/services/mappers/` — funciones puras que convierten filas de BD (snake_case) al tipo de dominio (camelCase); usan `schema.parse()` para validar

---

## Orden de implementación sugerido

1. `supabase/schema.sql` — schema completo con RLS (incluida tabla `accounts`)
2. Setup Next.js + Supabase clients (browser + server)
3. Auth pages (login/registro) con Supabase Auth
4. Layout con sidebar + `AccountContext` + selector de cuenta
5. Parser NinjaTrader + página `/import` (auto-crea cuentas desde el CSV)
6. `lib/calculations/metrics.ts`
7. Dashboard con métricas y equity curve
8. Página `/trades` con tabla y filtros
9. Trade View `/trades/[id]`
10. Reports `/reports`
11. Strategies CRUD
12. Journal con calendario
13. `/accounts` — página de ajustes de cuentas (último, no es bloqueante)

---

## Reglas de React

- **No hacer `setState` dentro de `useEffect` para sincronizar con props** — causa dobles renders en cascada. En su lugar, usar el **key reset pattern**: pasar `key={valorQueIdentificaElEstado}` al componente hijo para que React lo desmonte/monte automáticamente, reseteando el estado sin efectos. Ejemplo: `<DayDrawer key={selectedDate} ... />` en lugar de `useEffect(() => { setDraft(initDraft(day)) }, [day.date])`.

---

## Notas importantes

- Siempre usar **Row Level Security** en Supabase. Nunca exponer datos de otros usuarios.
- El CSV de NinjaTrader puede tener trades parcialmente cerrados — ignorar filas sin `Exit time`.
- Los contratos de NQ tienen valor de tick $5 (0.25 pts). El CSV ya exporta el P&L en USD, no recalcular.
- Para futuros el `commission` es crítico (suele ser $8-10 por contrato RT). Siempre mostrar net_pnl.
- **Cuentas auto-creadas**: el import CSV y el ingest del add-on (`/api/ingest/ninjatrader`) son las únicas fuentes de creación de cuentas. Usar `upsert` con `ignoreDuplicates: true` para no sobreescribir configuración manual del usuario (color, tipo, balance).
- **AccountContext**: crear en `contexts/AccountContext.tsx`. Provee `activeAccount: Account | null` y `setActiveAccount`. Persiste en `localStorage` con la key `"active_account_id"`. El layout del dashboard lo wrappea.
- **Vista "Todas las cuentas"**: cuando `activeAccount === null`, las queries usan `.in('account_id', userAccountIds)` en lugar de `.eq('account_id', id)`.
- **Primera vez sin trades**: si el usuario entra al dashboard sin haber importado nada, mostrar un estado vacío con CTA directo a `/import`. No redirigir a `/accounts`.