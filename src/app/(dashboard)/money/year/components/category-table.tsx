import type { ReactElement } from "react"
import { MONEY } from "~/constants/copies/money"
import type { YearCategory, YearMonth } from "~/lib/finance/year"
import type { FinanceCategory } from "~/types/finance"
import { fmtEur } from "../../components/money-format"

const Y = MONEY.YEAR
const UNCATEGORIZED_COLOR = "var(--color-short)"

function monthInitial(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "narrow", timeZone: "UTC" })
}

// §5.10: gasto por categoría en el año. Cada fila lleva una tira de 12 celdas
// (enero → diciembre) con la intensidad del gasto de ese mes respecto a su
// mes más alto; en móvil solo nombre, total y parte. Una categoría en neto
// negativo (p. ej. Bizum con más recibido que enviado) va en verde y sin parte.
export function CategoryTable({ rows, months, categories }: {
  rows:       YearCategory[]
  months:     YearMonth[]
  categories: FinanceCategory[]
}): ReactElement {
  if (rows.length === 0) return <div className="px-4 py-8 text-center text-sm text-text-mute">{Y.NO_SPENDING}</div>
  const byId = new Map(categories.map(c => [c.id, c]))
  const cols = "minmax(0, 1fr) auto auto"
  const colsMd = "minmax(0, 160px) 1fr auto auto"

  return (
    <div className="flex flex-col text-sm">
      <div className="hidden md:grid gap-3 items-center px-4 py-2 border-b border-border label-caps" style={{ gridTemplateColumns: colsMd }}>
        <span>{Y.COL_CATEGORY}</span>
        <span className="grid grid-cols-12 gap-0.5 text-center normal-case">
          {months.map(m => <span key={m.month} className="mono text-xxs text-text-mute">{monthInitial(m.month)}</span>)}
        </span>
        <span className="text-right" style={{ width: 90 }}>{Y.COL_TOTAL}</span>
        <span className="text-right" style={{ width: 48 }}>{Y.COL_SHARE}</span>
      </div>
      {rows.map(r => {
        const category = r.categoryId ? byId.get(r.categoryId) ?? null : null
        const color = category?.color ?? UNCATEGORIZED_COLOR
        const name = category?.name ?? MONEY.IMPORT.UNCATEGORIZED
        const rowMax = Math.max(...r.byMonth, 0)
        const net = r.total < 0
        const totalCls = net ? "text-profit" : "text-text"
        const share = net ? "—" : `${Math.round(r.share * 100)}%`
        const strip = (
          <span className="grid grid-cols-12 gap-0.5">
            {r.byMonth.map((v, i) => (
              <span
                key={months[i]!.month}
                className="h-4 rounded-xs bg-surface-2"
                title={`${months[i]!.month} · ${fmtEur(v, { decimals: 0 })}`}
                style={v > 0 && rowMax > 0 ? { background: color, opacity: 0.25 + 0.75 * (v / rowMax) } : undefined}
              />
            ))}
          </span>
        )
        const nameCell = (
          <span className="flex items-center gap-2 min-w-0">
            <span className="size-2 rounded-full shrink-0" style={{ background: color }} />
            <span className={category ? "text-text truncate" : "text-short truncate"}>{name}</span>
          </span>
        )
        return (
          <div key={r.categoryId ?? "none"} className="border-b border-border last:border-0">
            <div className="hidden md:grid gap-3 items-center px-4 py-2" style={{ gridTemplateColumns: colsMd }}>
              {nameCell}
              {strip}
              <span className={`mono text-right ${totalCls}`} style={{ width: 90 }}>{fmtEur(r.total, { decimals: 0 })}</span>
              <span className="mono text-xs text-right text-text-mute" style={{ width: 48 }}>{share}</span>
            </div>
            <div className="grid md:hidden gap-3 items-center px-4 py-2.5" style={{ gridTemplateColumns: cols }}>
              {nameCell}
              <span className={`mono text-right ${totalCls}`}>{fmtEur(r.total, { decimals: 0 })}</span>
              <span className="mono text-xs text-right text-text-mute" style={{ width: 40 }}>{share}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
