# MONEY — Gastos, ahorro y suscripciones (v2)

Módulo de TradeOS para saber **cuánto entra, cuánto sale y en qué**, a partir del export de movimientos del banco (imagin / CaixaBankNow). Es el módulo que responde la pregunta previa a cualquier plan de inversión: la tasa de ahorro real.

**v2 (28/10/2026):** fusiona la spec v1 con el diseño del canvas y actualiza el shell al conmutador de módulos ya implementado. Cambios respecto a v1: entran Objetivos de ahorro, gasto en efectivo manual (móvil), dividir y excluir movimientos, panel "por confirmar" de suscripciones y uso de suscripciones; Presupuestos pasa a v2 explícita; el §0 del shell desaparece porque ya está hecho.

**Diseño de referencia:** canvas "TradeOS — Gastos y Ahorro", https://claude.ai/artifact/PLRmpbfj8X1F4HhP6jCjHW. Cada pantalla de §5 indica su artboard. El diseño manda en **disposición y jerarquía**; esta spec manda en **datos, reglas y alcance**. Donde se contradigan, gana la spec y se anota aquí. El sidebar del diseño (Journal / Invest / Gastos) está desfasado: la app ya tiene el conmutador Trading / Invest / Money y el sidebar de Money lista las pantallas de §5. Los textos del diseño están en español; la app va en inglés como el resto (copies en §6).

Principios:
- **Entrada manual de un fichero**, como el CSV de NinjaTrader. imagin no tiene API y no se integra con agregadores bancarios (§9).
- **La categorización es el producto.** Un movimiento sin categoría no vale nada; categorizar tiene que ser rápido y la segunda vez automático.
- **Desacoplado en el código, acoplado en la app.** Tablas `finance_*`, rutas `/money/*`, sin importar nada de `trades`/`accounts`/`invest_*` ni al revés. Ya documentado en CLAUDE.md ("Shell de módulos").
- **Nada se declara dos veces.** Suscripciones, ahorro real y objetivos se calculan a partir de `finance_transactions`. El usuario solo categoriza y confirma.

---

## 1. Objetivo del módulo

Cada mes, en una pantalla, responder:
1. Cuánto ha entrado y cuánto ha salido, excluyendo transferencias entre cuentas propias.
2. **Ahorro real** = ingresos − (fijos + variables), y **tasa de ahorro** = ahorro real / ingresos.
3. En qué se ha ido, por categoría, comparado con el mes anterior y la media de 3 meses; cuánto es fijo y cuánto variable.
4. Qué suscripciones están activas, cuánto suman al mes y al año, y cuáles no se usan.
5. Cómo van los objetivos de ahorro con el reparto del ahorro real del mes.
6. Cuántos movimientos quedan sin categorizar (debe tender a cero).

---

## 2. Schema (Supabase)

Migración `supabase/migrations/20261103120000_finance.sql`, rollback `supabase/rollbacks/20261103120000_finance_down.sql`, y añadir a `supabase/schema.sql`. RLS en todas: `for all using (auth.uid() = user_id)` (en las tablas sin `user_id`, a través de la fila padre).

### 2.1 `finance_accounts` — cuentas bancarias (no confundir con `accounts` de trading)
```sql
create table if not exists finance_accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users on delete cascade not null,
  name        text not null,                 -- "imagin", "Cuenta remunerada MyInvestor"
  kind        text not null check (kind in ('checking','savings','broker','cash')),
  currency    text not null default 'EUR',
  iban_last4  text,                          -- solo display ("ES•• 4471"); nunca el IBAN completo
  active      boolean default true,
  created_at  timestamptz default now(),
  unique (user_id, name)
);
```
Al crear `finance_settings` se crea también una cuenta `cash` llamada "Cash" para los gastos en efectivo (§5.7).

### 2.2 `finance_categories`
```sql
create table if not exists finance_categories (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid references auth.users on delete cascade not null,
  name      text not null,
  kind      text not null check (kind in ('expense','income','transfer','savings')),
  is_fixed  boolean not null default false,  -- fijo (alquiler, furgo, seguros, suscripciones) vs variable
  color     text default '#64748b',
  sort      integer default 0,
  archived  boolean default false,
  unique (user_id, name)
);
```
Seed (server action `seedDefaultCategories`, no SQL) al crear `finance_settings`: Housing (fixed), Vehicle (fixed), Insurance (fixed), Utilities (fixed), Subscriptions (fixed), Groceries, Eating out, Transport, Health, Sports, Shopping, Travel, Gifts, Other expense; Salary (income), Other income; Transfer (transfer); Savings/Investing (savings).

`kind` decide el cálculo: `expense` e `income` entran en la tasa de ahorro; `transfer` se excluye siempre; `savings` sale de la cuenta pero **cuenta como ahorro**, no como gasto (una aportación al indexado no es un gasto).

### 2.3 `finance_transactions`
```sql
create table if not exists finance_transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users on delete cascade not null,
  account_id      uuid references finance_accounts(id) on delete cascade not null,
  booked_at       date not null,
  amount          numeric(12,2) not null,     -- firmado: negativo = sale
  currency        text not null default 'EUR',
  concept_raw     text not null,              -- tal cual viene del banco
  counterparty    text,                       -- normalizeConcept() (§4.1)
  balance_after   numeric(12,2),              -- saldo tras el movimiento, si el export lo trae (entra en la huella)
  category_id     uuid references finance_categories(id) on delete set null,
  category_source text check (category_source in ('rule','manual','split')),
  excluded        boolean not null default false,  -- fuera de todos los cálculos (reembolso, traspaso propio)
  parent_id       uuid references finance_transactions(id) on delete cascade,  -- partes de un movimiento dividido
  notes           text,
  source          text not null default 'import' check (source in ('import','manual')),
  import_key      text not null,              -- huella (§3.3)
  created_at      timestamptz default now(),
  unique (account_id, import_key)
);
create index on finance_transactions (user_id, booked_at desc);
create index on finance_transactions (user_id, category_id);
create index on finance_transactions (user_id) where category_id is null and parent_id is null and not excluded;
```
**Dividir:** un movimiento se divide creando N hijos con `parent_id`, `source = 'manual'`, `category_source = 'split'`, cuyos importes suman el del padre (check en la action). El padre pasa a `excluded = true` y conserva su `import_key` para el dedupe. Los cálculos ignoran el padre y usan los hijos.

### 2.4 `finance_category_rules` — reglas aprendidas
```sql
create table if not exists finance_category_rules (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users on delete cascade not null,
  pattern       text not null,                -- texto normalizado; match por "contiene"
  category_id   uuid references finance_categories(id) on delete cascade not null,
  priority      integer not null default 0,
  created_from  uuid references finance_transactions(id) on delete set null,
  hits          integer not null default 0,   -- cuántos movimientos ha categorizado (display)
  created_at    timestamptz default now(),
  unique (user_id, pattern)
);
```

### 2.5 `finance_subscriptions` — recurrentes detectadas
```sql
create table if not exists finance_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users on delete cascade not null,
  counterparty  text not null,
  amount        numeric(12,2) not null,       -- mediana de los 3 últimos cargos
  cadence       text not null check (cadence in ('weekly','monthly','quarterly','yearly')),
  category_id   uuid references finance_categories(id) on delete set null,
  first_seen    date not null,
  last_seen     date not null,
  next_expected date,                         -- last_seen + cadencia
  occurrences   integer not null,
  status        text not null default 'pending' check (status in ('pending','confirmed','cancelled','ignored')),
  usage         text not null default 'unknown' check (usage in ('unknown','used','unused','fixed')),
  unused_since  date,                         -- cuando usage pasa a 'unused'
  updated_at    timestamptz default now(),
  unique (user_id, counterparty, cadence)
);
```
Se recalcula tras cada import (§4.3). `status`: `pending` (detectada, por confirmar), `confirmed`, `cancelled` (dada de baja; si vuelve a cobrar, la app avisa), `ignored` (no es una suscripción). `usage` lo marca el usuario; `fixed` = gasto fijo que no se cuestiona (seguro). "Candidatas a cancelar" = `confirmed` con `usage = 'unused'` desde hace ≥ 2 meses.

**Decisión de implementación (28/10/2026):** `updated_at` marca el último cambio **del usuario** (status o usage); el recálculo tras cada import no lo toca. Así, una `cancelled` cuyo `last_seen` es posterior a `updated_at` es una suscripción que ha vuelto a cobrar tras cancelarla (aviso arriba en §5.3), sin columna extra. El texto de "Detection rule" del diseño (≥ 3 cargos, ±5 %) se sustituye por el de esta spec (≥ 2 cargos, ±10 %), y el botón "Add manually" del diseño no se implementa (no está en §5.3).

### 2.6 `finance_goals` — objetivos de ahorro
```sql
create table if not exists finance_goals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users on delete cascade not null,
  name            text not null,
  target_amount   numeric(12,2) not null,
  saved_amount    numeric(12,2) not null default 0,  -- acumulado asignado hasta el último mes cerrado
  monthly_alloc   numeric(12,2) not null default 0,  -- reparto del ahorro real
  priority        integer not null default 1,        -- 1 = primero en recibir, último en recortar
  deadline        date,
  status          text not null default 'active' check (status in ('active','completed','archived')),
  created_at      timestamptz default now()
);
```
Los objetivos **no mueven dinero**: reparten sobre el papel el ahorro real del mes cerrado (§4.5). El dinero físico sigue en la cuenta hasta que el usuario lo traspase; ese traspaso se categoriza como `savings` o `transfer` y no es gasto.

### 2.7 `finance_settings`
```sql
create table if not exists finance_settings (
  user_id          uuid primary key references auth.users on delete cascade,
  month_start_day  integer not null default 1,
  default_account  uuid references finance_accounts(id) on delete set null,
  created_at       timestamptz default now()
);
```

---

## 3. Import

**Artboard:** `06 · Importar movimientos` (`project/Importar.dc.html`). Tres pasos (Subir → Revisar → Confirmar), tarjetas de recuento (leídas / nuevas / duplicadas / sin regla), tabla de preview con la categoría que se asignará y el estado Nuevo/Duplicado, duplicados plegados, explicación de la huella al pie.

### 3.1 Formato de imagin — PENDIENTE DE MUESTRA
No se implementa el parser específico hasta tener un export real (cabeceras + 2–3 filas anonimizadas). El diseño asume `.xlsx` de imagin / CaixaBankNow con columnas fecha, concepto, importe y saldo; **se confirma con la muestra**. Mientras tanto: importador **genérico con mapeo de columnas** en `src/lib/finance/parsers/generic.ts`, patrón de `src/lib/parsers/generic.ts` (`inspectCsv`, `guessMapping`), campos canónicos `date`, `concept`, `amount` (o `debit` + `credit`), `balance` (opcional), `currency` (opcional). Registro `src/lib/finance/parsers/registry.ts` con autodetección por cabecera; `imagin.ts` se añade con la muestra.

Si el export solo sale en `.xlsx`: dependencia `xlsx` (SheetJS) **solo para leer**, convirtiendo la hoja a filas antes del mismo pipeline. No instalar antes de ver la muestra. **Si cambia el formato (cabeceras no reconocidas), el parser avisa y no importa nada: no se adivinan columnas.**

### 3.2 Flujo `/money/import`
1. Elegir cuenta destino (o crearla ahí mismo).
2. Subir el fichero. Autodetección; si no, UI de mapeo con muestra de 5 filas.
3. Preview como el artboard: recuentos, tabla con categoría por regla y estado, duplicados plegados.
4. "Import N transactions": upsert por `(account_id, import_key)` ignorando duplicados; reglas (§4.2) sobre los nuevos; recalcular suscripciones (§4.3).
5. CTA a la cola de sin categorizar.

### 3.3 Huella (`src/lib/finance/fingerprint.ts`, tests)
`import_key = booked_at|amount (2 decimales)|normalizeConcept(concept_raw)|balance_after (si existe)|#n`, con `n` el ordinal entre idénticos del mismo fichero. El saldo tras el movimiento es lo que distingue dos cafés iguales el mismo día cuando el export lo trae; si no lo trae, el ordinal `#n` lo cubre. Re-importar un mes o solapar rangos no duplica nada.

---

## 4. Lógica pura (`src/lib/finance/*.ts`, vitest al lado de cada archivo)

### 4.1 `normalizeConcept(raw): string`
Minúsculas, sin acentos, sin números de > 4 dígitos, sin fechas incrustadas, sin prefijos bancarios ("compra tarj.", "pago movil", "bizum enviado/recibido", "recibo", "transferencia a favor de"), sin nombres enmascarados ("P*** C***"), espacios colapsados. Tests con 10 conceptos reales de banco español. El resultado es `counterparty` y sobre él casan las reglas.

### 4.2 `matchRule(counterparty, rules): Rule | null`
"Contiene" sobre texto normalizado; gana `priority` y, a igualdad, el patrón más largo. Solo sobre movimientos sin categoría o con `category_source = 'rule'`; nunca pisa `manual` ni `split`.

**Aprendizaje:** al categorizar a mano, el panel propone crear una regla con `pattern = counterparty` (checkbox marcado, patrón editable). Al guardar se reaplica a todo lo pendiente del usuario, se informa cuántos ha categorizado y se actualiza `hits`. El panel del movimiento muestra la regla aplicada, cuándo se creó y cuántos hits lleva (como en el artboard de Movimientos).

### 4.3 `detectRecurring(transactions): RecurringCandidate[]`
Agrupa por `counterparty`; importes dentro de ±10 % de la mediana de los 3 últimos; cadencia por intervalo: semanal 6–8 días, mensual 28–33, trimestral 85–97, anual 355–375; mínimo 2 ocurrencias. Devuelve candidatos con `next_expected`. El upsert en `finance_subscriptions` **nunca cambia** un `status` ni un `usage` ya puesto por el usuario; los nuevos entran como `pending`. Tests: Netflix mensual, seguro trimestral, Bizum irregular (no recurrente), importe que cambia de 9,99 a 12,99 (misma suscripción), parking con ±8 % (candidata, el usuario decide).

### 4.4 `monthlySummary(transactions, categories, month)` y `savingsRate(summary)`
Ingresos (`income`), gastos (`expense`) separados en fijo/variable por `is_fixed`, ahorro explícito (`savings`), transferencias y `excluded` fuera, dividido → hijos. Por categoría: total del mes, mes anterior, media 3 meses, delta. Ahorro real = ingresos − fijos − variables. Proyección simple de fin de mes para el resumen: gastado + ritmo diario de los últimos 14 días × días restantes (los fijos se proyectan a su importe conocido). Tests con un mes sintético que incluye un traspaso propio (no cuenta), una aportación al indexado (ahorro, no gasto), un movimiento dividido y uno excluido.

**Decisión de implementación (28/10/2026):** lo **sin categorizar** cuenta así mientras quede cola: las salidas, como gasto variable; las entradas, no cuentan como ingreso (se informan aparte). Así el ahorro real nunca sale inflado por movimientos pendientes. La media de 3 meses usa solo los meses con datos (antes del primer movimiento no hay historia, no son ceros).

### 4.5 `allocateSavings(goals, realSavings): Allocation[]`
Reparte el ahorro real del mes cerrado entre objetivos activos según `monthly_alloc` y `priority`: si el ahorro no llega, se recorta primero el de menor prioridad (número más alto). Devuelve lo asignado a cada uno y el sobrante sin asignar. `saved_amount` se actualiza al cerrar el mes (action manual "Close month" o automáticamente la primera vez que se visita Money en el mes siguiente). Fecha estimada de completar = meses restantes a `monthly_alloc`. Tests: ahorro suficiente, insuficiente con recorte por prioridad, objetivo completado a mitad.

---

## 5. Pantallas

Todas en el módulo Money del conmutador; sidebar: Overview, Transactions, Subscriptions, Goals, Import, Settings. Pie del sidebar con la cuenta por defecto y "Imported through <fecha>" (como en el diseño).

### 5.1 `/money` — Overview · artboard `01 · Resumen del mes` (`Main.dc.html`)
- Cabecera: mes, "N days left · d of D", chip del estado del último import (ámbar si > 7 días), botón Import.
- Fila de avisos (chips): categoría pasada de su media/presupuesto, N sin categorizar, comparación con el ritmo del mes anterior.
- Cuatro tarjetas: **Spent this month** (con barra sobre la media de 3 meses mientras no haya presupuestos), **Left** (proyección), **Real savings** (importe y % de ingresos), **Active subscriptions** (n, €/mes, €/año, n sin usar).
- Gasto por categoría (barras; la marca de referencia es la media 3 meses en v1, el presupuesto en v2) con enlace a Transactions filtrado.
- Próximas renovaciones (4) con enlace a Subscriptions.
- Flujo del mes: barra apilada Fijos / Variables / Ahorro + cifras + media 6 meses.
- Objetivos (barras) con enlace a Goals.
- Estado vacío sin transacciones: CTA a Import. Sin `finance_settings`: formulario de alta (cuenta + seed de categorías).

### 5.2 `/money/transactions` — artboard `02 · Movimientos` (`Movimientos.dc.html`)
- Tabla agrupada por día: fecha, concepto (nombre limpio + raw en mono pequeño), categoría (badge con color), importe, saldo.
- Filtros: búsqueda, mes, categoría, botón **Uncategorized · N** (modo cola).
- Panel lateral del movimiento seleccionado: datos, selector de categoría, bloque "Rule applied" (patrón, fecha, hits) o checkbox "Create rule: *patrón*" si se categoriza a mano, nota, checkbox **Exclude from calculations** (reembolso, traspaso propio), botones Save y **Split**.
- **Split:** modal con N filas (categoría + importe), suma validada contra el original.
- **Modo cola:** solo sin categorizar, navegación con ↑↓, Enter abre el select, Esc cierra, Enter guarda y pasa al siguiente. Objetivo: 50 movimientos en 5 minutos.

### 5.3 `/money/subscriptions` — artboard `03 · Suscripciones` (`Suscripciones.dc.html`)
- Cabecera: activas, €/mes, €/año (anuales/12, trimestrales/3).
- Pestañas: Confirmed / Pending / Ignored. Tabla: servicio (tipo de cargo + nº cargos), cadencia, importe, próximo cargo (ámbar si ≤ 3 días), uso (dot verde "Used", rojo "Unused N months", gris "Fixed"), Edit.
- Panel **Pending**: cada candidata con su evidencia ("4 charges · every 30 ± 1 days · same amount") y botones Confirm / Not a subscription.
- Panel **Candidates to cancel**: confirmadas sin usar ≥ 2 meses, con ahorro anual si se cancelan.
- Una `cancelled` que vuelve a cobrar aparece arriba con aviso.

### 5.4 `/money/goals` — artboard `05 · Objetivos de ahorro` (`Objetivos.dc.html`)
- Cabecera con la frase del diseño ("Goals don't move money: they allocate each month's real savings on paper") y botón New goal.
- Tarjeta "Savings capacity": ahorro real del mes y media 6 meses; reparto mensual por objetivo; sobrante sin asignar; nota de recorte por prioridad.
- Una tarjeta por objetivo: prioridad, saved/target con barra, aportación mensual, falta, fecha estimada ("tight" si la fecha límite está justa), Edit.
- Formulario New goal: nombre, importe, fecha límite opcional; muestra la fecha estimada con lo libre o la aportación necesaria para la fecha.
- Bloque "What real savings means" con el texto del diseño.

### 5.5 `/money/import` — §3.

### 5.6 `/money/settings`
Pestañas: Accounts (CRUD `finance_accounts`), Categories (CRUD + is_fixed + color + archivar), Rules (lista con hits; borrar una regla no descategoriza), Month (día de inicio, Close month manual).

### 5.7 Móvil — artboards `M1 · Móvil · Resumen` y `M2 · Móvil · Gasto en efectivo`
No es una app aparte: es el responsive de `/money` más una pantalla nueva.
- **M1:** `/money` a 390 px: "Left this month" grande, dos tarjetas (ahorro real, suscripciones), categorías, próximas renovaciones, barra inferior con Overview / Transactions / **+** / Subscriptions / Goals. La barra inferior solo aparece en Money y a ancho de móvil.
- **M2:** `/money/cash` — alta rápida de gasto en efectivo: importe con teclado numérico propio (no el del sistema), categoría (chips de las 5 más usadas + "más"), concepto opcional, Save con fecha de hoy. Crea una transacción `source = 'manual'` en la cuenta `cash` con `import_key = manual|<uuid>`. "Solo para lo que el banco no ve."

---

## 6. Convenciones del repo
- `src/types/finance.ts` (Zod), `src/services/mappers/finance.ts`, `src/services/queries/finance.ts`, `src/actions/finance.ts`, copies en `src/constants/copies/money/index.ts` (inglés), componentes exclusivos en `src/app/(dashboard)/money/**/components/`.
- Lógica pura en `src/lib/finance/` con test al lado.
- Nada importa de `~/types/trade`, `~/services/queries/trades`, `AccountContext` ni `invest_*`. Regla `no-restricted-imports` para `src/app/(dashboard)/money/**` y `src/lib/finance/**`.
- Colores y tipografía: DESIGN.md manda sobre los hex del canvas (el canvas usa una paleta aproximada). Mono para todos los importes.

---

## 7. Orden de implementación
1. Migración + rollback + `schema.sql`.
2. Lógica pura con tests: `normalizeConcept`, `fingerprint`, `matchRule`, `detectRecurring`, `monthlySummary`, `allocateSavings`.
3. Tipos, mappers, queries, actions; seed de categorías y cuenta Cash; alta de `finance_settings`.
4. `/money/import` con el parser genérico (y SheetJS si la muestra lo exige).
5. `/money/transactions` con cola, reglas, split y exclude.
6. `/money` overview (escritorio y móvil).
7. `/money/subscriptions`.
8. `/money/goals`.
9. `/money/cash` y barra inferior móvil.
10. `/money/settings`.
11. Parser específico de imagin con la muestra real (puede adelantarse al paso 4 si la muestra llega antes).
12. `CLAUDE.md`: sección "Money" (tablas, flujo de import, reglas, objetivos).

Commit por paso; lint y tests en verde antes de cada uno. Enséñame el resultado tras el paso 5 (import + cola funcionando con datos reales) antes de seguir.

---

## 8. Relación con Invest
Ninguna en código. La tasa de ahorro que sale de aquí es la que decide cuándo se activa el satélite de Invest (núcleo ≥ 12–15 k €); la decisión es humana. Una futura vista "Net worth" leerá de los tres módulos sin escribir en ninguno (CLAUDE.md, Shell de módulos).

---

## 9. Fuera de alcance

### v2 (después de 3 meses de datos reales)
- **Presupuestos por categoría** · artboard `04 · Presupuestos` (`Presupuestos.dc.html`): importe editable por categoría, "Copy from last month", proyección, sugerido = media 3 meses redondeada a la decena, fila fija para suscripciones (auto). El diseño ya está; se implementa cuando haya tres meses de media con la que sugerir. Hasta entonces, las barras del Overview usan la media 3 meses como referencia.
- Proyecciones (FIRE, interés compuesto) sobre `savingsRate`.
- Categorización asistida con IA para el residuo que las reglas no cubran, con la `ANTHROPIC_API_KEY` de Insights.

### No se hace
- Conexión directa con bancos (PSD2, agregadores). El import manual es suficiente y no mete credenciales bancarias en la app.
- Alertas por email/push.
- Multidivisa. Todo EUR.
- Que los objetivos muevan dinero o se integren con el bróker.
