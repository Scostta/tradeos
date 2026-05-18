import type { ReactElement } from "react"

type Props = {
  pct: number
  size?: number
  stroke?: number
}

export function WinRateDonut({ pct, size = 36, stroke = 4 }: Props): ReactElement {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const off = c * (1 - pct)
  const name = `wr-${Math.round(pct * 1000)}`

  return (
    <svg width={size} height={size} style={{ display: "block" }}>
      <style>{`@keyframes ${name}{from{stroke-dashoffset:${c}}to{stroke-dashoffset:${off}}}`}</style>
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke="var(--color-border)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={off}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ animation: `${name} 0.8s ease-out forwards` }}
      />
    </svg>
  )
}
