import type { ReactElement, ReactNode } from "react"

type LegendItem = {
  label: string
  color: string
}

type Props = {
  label:    string
  children: ReactNode
  legend?:  LegendItem[]
}

export function ChartFrame({ label, children, legend }: Props): ReactElement {
  const monoFont = "var(--mono, 'JetBrains Mono'), ui-monospace, monospace"

  return (
    <div
      className="card"
      style={{ padding: 16, display: "flex", flexDirection: "column" }}
    >
      {/* Metric pill label */}
      <div
        style={{
          display:      "inline-flex",
          alignItems:   "center",
          gap:          7,
          padding:      "5px 9px",
          background:   "var(--color-surface)",
          border:       "1px solid var(--color-border)",
          borderRadius: 6,
          fontFamily:   monoFont,
          fontSize:     12,
          color:        "var(--color-text)",
          marginBottom: 14,
          alignSelf:    "flex-start",
        }}
      >
        <span
          style={{
            width:        12,
            height:       12,
            borderRadius: 3,
            background:   "var(--color-accent)",
            display:      "inline-block",
          }}
        />
        {label}
      </div>

      {children}

      {legend && (
        <div style={{ display: "flex", justifyContent: "center", gap: 18, marginTop: 4 }}>
          {legend.map((l, i) => (
            <span
              key={i}
              style={{
                display:    "flex",
                alignItems: "center",
                gap:        6,
                fontSize:   11,
                color:      "var(--color-text-mute)",
              }}
            >
              <span
                style={{ width: 8, height: 8, borderRadius: 4, background: l.color }}
              />
              {l.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
