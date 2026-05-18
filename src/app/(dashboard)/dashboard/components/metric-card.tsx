import type { ReactElement } from "react"

type Props = {
  label:       string
  value:       string
  valueClass?: string
  sub?:        string
  accent?:     ReactElement
}

export function MetricCard({ label, value, valueClass, sub, accent }: Props): ReactElement {
  return (
    <div className="card p-4 flex flex-col gap-2 min-h-24">
      <div className="flex justify-between items-start">
        <div className="label-caps">{label}</div>
        {accent}
      </div>
      <div
        className={`mono text-3xl font-semibold tracking-tight leading-none ${valueClass ?? "text-text"}`}
      >
        {value}
      </div>
      {sub && (
        <div className="text-sm text-text-mute mt-auto">{sub}</div>
      )}
    </div>
  )
}
