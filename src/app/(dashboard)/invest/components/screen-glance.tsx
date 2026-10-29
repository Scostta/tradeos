import type { ReactElement } from "react"
import Link from "next/link"
import { APP_URLS } from "~/constants/app-urls"
import { INVEST } from "~/constants/copies/invest"
import { MAX_OPEN_PER_SECTOR } from "~/lib/calculations/invest-run"
import type { InvestPositionWithMeta, ScreenResult } from "~/types/invest"
import { cn } from "~/utils/cn"
import { sectorColor } from "./heat"

const S = INVEST.SCREEN

// §4.2 de un vistazo: los huecos del satélite y dónde están los que pasan,
// con el uso del límite por sector.
export function ScreenGlance({ passers, open, maxPositions, sectorOrder }: {
  passers:      ScreenResult[]
  open:         InvestPositionWithMeta[]     // las que cuentan para los límites
  maxPositions: number
  sectorOrder:  string[]                     // sectores por nº de passers (colores estables)
}): ReactElement {
  const slots = Array.from({ length: maxPositions }, (_, i) => open[i] ?? null)
  const bySector = sectorOrder.map(name => ({
    name,
    count: passers.filter(p => p.sector === name).length,
    open: open.filter(p => p.sector === name).length,
  }))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <div className="card flex flex-col gap-2.5 px-4 py-3.5 min-w-0">
        <span className="label-caps">{S.SLOTS}</span>
        <div className="flex gap-2">
          {slots.map((p, i) => p ? (
            <Link
              key={p.id} href={`${APP_URLS.INVEST_POSITIONS}/${p.id}`}
              className="flex-1 min-w-0 h-11 rounded-md border border-accent/40 bg-accent/10 flex items-center justify-center mono text-xs font-semibold text-text hover:border-accent"
            >
              {p.ticker}
            </Link>
          ) : (
            <span key={`free-${i}`} className="flex-1 h-11 rounded-md border border-dashed border-border-hi" />
          ))}
        </div>
        <span className="text-sm text-text-mute">{S.SLOTS_SUB.replace("{open}", String(open.length)).replace("{max}", String(maxPositions)).replace("{free}", String(Math.max(0, maxPositions - open.length)))}</span>
      </div>

      <div className="card flex flex-col gap-2.5 px-4 py-3.5 min-w-0 lg:col-span-2">
        <span className="label-caps">{S.SECTORS.replace("{max}", String(MAX_OPEN_PER_SECTOR))}</span>
        <div className="flex gap-0.5 h-5 rounded-sm overflow-hidden" role="img" aria-label={bySector.map(s => `${s.name} ${s.count}`).join(", ")}>
          {bySector.map(s => <span key={s.name} style={{ flex: s.count, background: sectorColor(s.name, sectorOrder) }} />)}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {bySector.map(s => (
            <span key={s.name} className="inline-flex items-center gap-1.5 text-xs text-text-dim">
              <span className="size-2 rounded-sm" style={{ background: sectorColor(s.name, sectorOrder) }} />
              {s.name} <span className="mono text-text">{s.count}</span>
              <span className={cn("mono", s.open >= MAX_OPEN_PER_SECTOR ? "text-loss" : s.open > 0 ? "text-short" : "text-text-mute")}>
                {s.open}/{MAX_OPEN_PER_SECTOR}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
