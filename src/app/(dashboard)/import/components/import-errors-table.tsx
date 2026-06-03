import type { ReactElement } from "react"
import type { ParseError } from "~/types"

type Props = {
  errors: ParseError[]
}

export function ImportErrorsTable({ errors }: Props): ReactElement {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <span className="label-caps text-loss">Errors · {errors.length} rows skipped</span>
      </div>
      <div className="overflow-y-auto max-h-52">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-surface z-10">
            <tr>
              <th className="label-caps px-3 py-2.5 border-b border-border text-left w-16">Line</th>
              <th className="label-caps px-3 py-2.5 border-b border-border text-left w-24">Account</th>
              <th className="label-caps px-3 py-2.5 border-b border-border text-left w-24">Instrument</th>
              <th className="label-caps px-3 py-2.5 border-b border-border text-left">Reason</th>
            </tr>
          </thead>
          <tbody>
            {errors.map((err) => (
              <tr key={err.line} className="border-b border-border last:border-0">
                <td className="px-3 py-2 mono text-sm text-text-mute">{err.line}</td>
                <td className="px-3 py-2 mono text-sm text-text-dim">{err.accountName ?? "—"}</td>
                <td className="px-3 py-2 mono text-sm text-text-dim">{err.instrument ?? "—"}</td>
                <td className="px-3 py-2 text-sm text-loss">{err.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
