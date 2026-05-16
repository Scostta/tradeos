# CLAUDE.md — Trading Journal MVP

## Descripción del proyecto

Aplicación web de diario y tracking de trading estilo Tradezella, orientada a traders de futuros (NQ/ES). Permite importar trades desde NinjaTrader vía CSV, visualizar métricas de rendimiento y gestionar estrategias y journal diario.

Un usuario puede tener **múltiples cuentas de trading** (ej. cuenta real, cuenta funded, cuenta demo, distintos brokers). Toda la app filtra por la cuenta activa seleccionada en el selector global del sidebar. Las métricas, trades, journal y reports son siempre por cuenta.

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
│   │   └── accounts/page.tsx   # CRUD de cuentas de trading
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

### Tabla `accounts` ⬅️ NUEVA

Cada usuario puede tener múltiples cuentas de trading (real, funded, demo, distintos brokers).

```sql
create table accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,                -- ej. "Cuenta Real FTMO", "Demo NinjaTrader"
  broker text,                       -- ej. "Tradovate", "Rithmic", "TopStep"
  account_type text check (account_type in ('real', 'funded', 'demo', 'paper')) not null default 'real',
  currency text default 'USD',
  initial_balance numeric(12,2),     -- balance inicial para calcular DD sobre cuenta
  active boolean default true,
  color text default '#3b82f6',      -- color identificador en la UI (hex)
  notes text,
  created_at timestamptz default now()
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

-- Constraint de unicidad ahora incluye account_id
create unique index trades_no_duplicates
  on trades (account_id, instrument, entry_time);

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

```sql
create table daily_journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  account_id uuid references accounts(id) on delete cascade not null,  -- ⬅️ FK a accounts
  date date not null,
  pre_market_notes text,
  post_market_notes text,
  mood integer check (mood between 1 and 5),
  followed_plan boolean,
  created_at timestamptz default now(),
  unique(account_id, date)   -- ⬅️ unicidad por cuenta + día, no por usuario + día
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
    │        ├──< trades (account_id)
    │        │        └──> strategies (strategy_id)  [opcional]
    │        │
    │        └──< daily_journal (account_id)
    │
    └──< strategies (user_id)   [globales, sin cuenta]
```

---

## Parser CSV de NinjaTrader

El CSV de NinjaTrader (exportado desde Trade Performance → Export) tiene este formato:

```
Trade #,Instrument,Market pos.,Quantity,Entry price,Exit price,Entry time,Exit time,Profit,Commission,MAE,MFE
1,NQ 03-25,Long,1,19850.00,19875.00,3/10/2025 9:32:01 AM,3/10/2025 9:45:22 AM,500.00,8.50,-120.00,620.00
```

El parser vive en `lib/parsers/ninjatrader.ts` y debe:
1. Parsear las columnas arriba indicadas
2. Normalizar `Market pos.` → `long | short`
3. Extraer el símbolo limpio del instrumento (`NQ 03-25` → `NQ`)
4. Calcular `net_pnl = profit - commission`
5. Convertir fechas al formato ISO 8601
6. Recibir `account_id` como parámetro (seleccionado por el usuario en `/import` antes de subir el CSV)
7. Hacer upsert en Supabase (evitar duplicados por `account_id + instrument + entry_time`)

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
- Acceso rápido a "Gestionar cuentas" → `/accounts`.

### `/accounts`
- Grid de cards, una por cuenta.
- Cada card: nombre, broker, tipo (badge: Real / Funded / Demo / Paper), balance inicial, color, estado (activa/inactiva).
- Stats rápidas en cada card: total trades, net P&L acumulado.
- Botón "Nueva cuenta" → modal con campos: nombre, broker, tipo, balance inicial, color (color picker), notas.
- CRUD completo: editar, archivar (soft delete: `active = false`).
- **No se permite eliminar** una cuenta con trades asociados; solo archivar.

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
- **Selector de cuenta obligatorio** antes de poder subir el CSV — si no hay cuentas creadas, redirige a `/accounts`.
- Drag & drop de CSV.
- Preview de los trades parseados antes de confirmar.
- Indicador de duplicados detectados (para esa cuenta).
- Botón "Importar X trades a [nombre cuenta]".

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
- Calendario mensual con color por P&L del día (verde/rojo/gris) — filtrado por cuenta activa.
- Click en día → abre drawer con notas pre/post mercado, mood, trades del día.

---

## Variables de entorno requeridas

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # solo para API routes
```

---

## Convenciones de código

- **Copies** (`constants/copies/`): cada archivo exporta un único objeto en SCREAMING_SNAKE_CASE. Tanto el objeto raíz como todas sus claves (a cualquier nivel) deben ir en MAYÚSCULAS_CON_GUIÓN. Ejemplo: `COMMON.NAV_LABELS.DASHBOARD`, `AUTH.LOGIN.EMAIL_LABEL`. Nunca usar camelCase ni PascalCase en estos objetos.
- **Componentes UI generales**: viven en `src/lib/ui/` (ej. `button.tsx`). Solo componentes verdaderamente reutilizables en toda la app (botones, inputs, badges…). Named export siempre.
- **Iconos**: viven en `src/lib/ui/icons/`, un archivo por icono en kebab-case (ej. `log-out-icon.tsx`). Named export con el nombre del componente en PascalCase (ej. `export function LogOutIcon()`). Nunca definir iconos inline en componentes.
- **Componentes**: PascalCase (nombre del componente), pero **nombre de archivo en minúsculas** kebab-case (ej. `sidebar.client.tsx`, `metric-card.tsx`, `trade-row.tsx`)
- **Hooks**: `use` prefix, en `/hooks/`
- **Server Components** por defecto; `"use client"` solo cuando haya estado o interactividad
- **Tipos**: definidos en `types/index.ts`, no usar `any`
- **Errores**: siempre manejar errores de Supabase y mostrar toast al usuario
- **Fechas**: usar `date-fns` para formateo, siempre UTC internamente

### Tipografía — reglas estrictas

El sistema tipográfico está definido en `DESIGN.md` y en las variables CSS de `globals.css`.

- **Prohibido** `text-[Xpx]` — usar siempre la escala: `text-xxs` `text-xs` `text-sm` `text-base` `text-md` `text-lg` `text-xl` `text-2xl` `text-3xl` `text-4xl` `text-5xl`
- **Prohibido** `tracking-[Xem]` — usar siempre: `tracking-tight` `tracking-mono` `tracking-normal` `tracking-wide` `tracking-wider` `tracking-caps` `tracking-widest`
- **Prohibido** `rounded-[Xpx]` — usar siempre la escala: `rounded-xs` (1px) · `rounded-sm` (4px) · `rounded` (4px) · `rounded-md` (6px) · `rounded-lg` (8px) · `rounded-full`
- **Prohibido** `text-[color]` arbitrario — usar los tokens de color definidos (`text-text`, `text-text-dim`, `text-text-mute`, `text-accent`, `text-profit`, `text-loss`, etc.)
- Todos los valores numéricos mostrados al usuario (P&L, precios, cantidades, timestamps) deben ir con `font-mono` o la utility `mono`
- Los headers de sección uppercase deben usar la utility `label-caps` (no replicar los estilos manualmente)

---

## Orden de implementación sugerido

1. `supabase/schema.sql` — schema completo con RLS (incluida tabla `accounts`)
2. Setup Next.js + Supabase clients (browser + server)
3. Auth pages (login/registro) con Supabase Auth
4. Layout con sidebar + `AccountContext` + selector de cuenta
5. `/accounts` — CRUD de cuentas (necesario antes que import)
6. Parser NinjaTrader + página `/import` (requiere selección de cuenta)
7. `lib/calculations/metrics.ts`
8. Dashboard con métricas y equity curve
9. Página `/trades` con tabla y filtros
10. Trade View `/trades/[id]`
11. Reports `/reports`
12. Strategies CRUD
13. Journal con calendario

---

## Patrones React 19 — warnings conocidos

### No almacenar JSX en constantes de módulo
Guardar `<Component />` en un array o constante fuera del render crea elementos sin contexto de render y genera warnings en React 19.

```typescript
// MAL — genera warning
const NAV_ITEMS = [{ icon: <GridIcon /> }];
// BIEN — almacenar la referencia al componente
const NAV_ITEMS = [{ Icon: GridIcon }];
// Luego en JSX: <item.Icon />
```

### setState sincrónico dentro de useEffect
Llamar `setState` directamente en el cuerpo de un `useEffect` puede generar el warning *"Calling setState synchronously within an effect can trigger cascading renders"* en React 19. Envolver en `startTransition`:

```typescript
useEffect(() => {
  startTransition(() => {
    setState(value);
  });
}, [value]);
```

---

## Notas importantes

- Siempre usar **Row Level Security** en Supabase. Nunca exponer datos de otros usuarios.
- El CSV de NinjaTrader puede tener trades parcialmente cerrados — ignorar filas sin `Exit time`.
- Los contratos de NQ tienen valor de tick $5 (0.25 pts). El CSV ya exporta el P&L en USD, no recalcular.
- Para futuros el `commission` es crítico (suele ser $8-10 por contrato RT). Siempre mostrar net_pnl.
- **Cuentas**: el `account_id` debe estar presente en cada query a `trades` y `daily_journal`. Nunca hacer queries sin filtrar por cuenta (salvo la vista "Todas las cuentas" que hace un `in (account_ids_del_usuario)`).
- **AccountContext**: crear en `contexts/AccountContext.tsx`. Provee `activeAccount: Account | null` y `setActiveAccount`. Persiste en `localStorage` con la key `"active_account_id"`. El layout del dashboard lo wrappea.
- **Vista "Todas las cuentas"**: cuando `activeAccount === null`, las queries usan `.in('account_id', userAccountIds)` en lugar de `.eq('account_id', id)`.
- **No borrar cuentas con trades**: la FK `on delete cascade` está en el schema pero la UI debe impedir el borrado si hay trades asociados. Mostrar conteo de trades en el modal de confirmación y ofrecer solo "Archivar".