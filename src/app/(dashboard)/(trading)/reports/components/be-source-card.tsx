import type { ReactElement } from "react"
import Link from "next/link"
import type { BeSource } from "~/lib/calculations/be-analysis"
import { REPORTS } from "~/constants/copies/reports"
import { APP_URLS } from "~/constants/app-urls"
import { cn } from "~/utils/cn"

const C = REPORTS.BE.SOURCE

// De dónde sale la etiqueta BE (umbral o corrección a mano) y cuántos BE
// habría con otro umbral, para calibrarlo. Las correcciones se respetan.
export function BeSourceCard({ source }: { source: BeSource }): ReactElement {
  const current = source.whatIf.find(w => w.points === source.threshold)?.be ?? 0
  const counts = [
    { label: C.AUTO.replace("{pts}", String(source.threshold)), value: source.auto },
    { label: C.FORCED_BE,     value: source.forcedBe },
    { label: C.FORCED_NOT_BE, value: source.forcedNotBe },
  ]

  return (
    <div className="card p-0">
      <div className="px-4 py-3 border-b border-border">
        <span className="label-caps">{C.TITLE}</span>
      </div>
      <div className="grid grid-cols-3 gap-px bg-border border-b border-border">
        {counts.map(c => (
          <div key={c.label} className="bg-surface px-4 py-3.5 flex flex-col gap-1">
            <span className="label-caps">{c.label}</span>
            <span className="mono text-xl font-semibold text-text">{c.value}</span>
          </div>
        ))}
      </div>

      <div className="px-4 pt-3 label-caps">{C.WHAT_IF}</div>
      <table className="w-full text-xs mt-1">
        <thead>
          <tr className="text-text-mute">
            <th className="label-caps text-left font-normal px-4 py-2">{C.COL_POINTS}</th>
            <th className="label-caps text-right font-normal px-2 py-2">{C.COL_BE}</th>
            <th className="label-caps text-right font-normal px-4 py-2">{C.COL_DIFF}</th>
          </tr>
        </thead>
        <tbody>
          {source.whatIf.map(w => {
            const isCurrent = w.points === source.threshold
            const diff = w.be - current
            return (
              <tr key={w.points} className={cn("border-t border-border", isCurrent && "bg-surface-2")}>
                <td className="px-4 py-2 mono text-text">
                  ≤ {String(w.points)} pts
                  {isCurrent && <span className="ml-2 text-text-mute">{C.CURRENT}</span>}
                </td>
                <td className="px-2 py-2 mono text-right text-text">{w.be}</td>
                <td className="px-4 py-2 mono text-right text-text-dim">
                  {isCurrent ? "—" : diff === 0 ? "0" : `${diff > 0 ? "+" : "−"}${Math.abs(diff)}`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="px-4 py-2.5 text-xs text-text-mute border-t border-border">
        {C.HINT}{" "}
        <Link href={`${APP_URLS.TRADING_SETTINGS}?tab=break-even`} className="underline hover:text-text">{C.SETTINGS}</Link>.
      </div>
    </div>
  )
}
