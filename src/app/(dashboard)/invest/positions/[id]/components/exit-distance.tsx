import type { ReactElement } from "react"
import { INVEST } from "~/constants/copies/invest"
import { fmtPct, fmtPrice } from "../../../components/invest-format"

const D = INVEST.POSITION

// §4.3 de un vistazo: dónde está el precio respecto al nivel de salida del
// próximo cierre (zona roja a la izquierda) y a la entrada.
export function ExitDistance({ exitLevel, entry, last, currency }: {
  exitLevel: number
  entry:     number
  last:      number
  currency:  string | null
}): ReactElement {
  const lo = Math.min(exitLevel, entry, last) * 0.94
  const hi = Math.max(exitLevel, entry, last) * 1.04
  const at = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`
  const cushion = last / exitLevel - 1
  // Si entrada y último cierre quedan muy cerca, la etiqueta de la entrada sube.
  const entryAbove = Math.abs(entry - last) / (hi - lo) < 0.12

  return (
    <div className="card px-5 pt-3.5 pb-9 flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="label-caps">{D.DISTANCE_TITLE}</span>
        <span className={cushion < 0 ? "mono text-sm font-semibold text-loss" : "mono text-sm font-semibold text-text"}>
          {D.CUSHION.replace("{pct}", fmtPct(cushion, { sign: true }))}
        </span>
        <span className="ml-auto text-xs text-text-mute">{D.DISTANCE_RULE}</span>
      </div>
      <div
        className="relative h-2.5 rounded-full bg-surface-2"
        role="img"
        aria-label={D.DISTANCE_ARIA.replace("{exit}", fmtPrice(exitLevel, currency)).replace("{entry}", fmtPrice(entry, currency)).replace("{last}", fmtPrice(last, currency))}
      >
        <span className="absolute inset-y-0 left-0 rounded-l-full bg-loss/30" style={{ width: at(exitLevel) }} />
        <span className="absolute -top-2 h-6.5 w-0.5 bg-loss" style={{ left: at(exitLevel) }} />
        <span className="absolute -top-7 -translate-x-1/2 mono text-xs text-loss whitespace-nowrap" style={{ left: at(exitLevel) }}>
          {D.EXIT_AT.replace("{price}", fmtPrice(exitLevel, currency))}
        </span>
        <span className="absolute -top-1 h-4.5 w-0.5 bg-long" style={{ left: at(entry) }} />
        <span className={`absolute ${entryAbove ? "-top-7" : "top-5"} -translate-x-1/2 mono text-xs text-long whitespace-nowrap`} style={{ left: at(entry) }}>
          {D.ENTRY_AT.replace("{price}", fmtPrice(entry, currency))}
        </span>
        <span
          className="absolute -top-1.5 size-5.5 -translate-x-1/2 rounded-full bg-accent"
          style={{ left: at(last), boxShadow: "0 0 12px var(--accent-glow)" }}
        />
        <span className="absolute top-5 -translate-x-1/2 mono text-xs font-semibold text-text whitespace-nowrap" style={{ left: at(last) }}>
          {fmtPrice(last, currency)}
        </span>
      </div>
    </div>
  )
}
