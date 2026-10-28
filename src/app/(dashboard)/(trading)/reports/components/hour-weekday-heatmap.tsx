import type { ReactElement } from "react"
import type { HourWeekdayMatrix } from "~/types/reports"
import { REPORTS } from "~/constants/copies/reports"
import { formatCompactCurrency } from "~/helpers/format"

type Props = {
  matrix: HourWeekdayMatrix
}

const pad2 = (n: number): string => String(n).padStart(2, "0")

export function HourWeekdayHeatmap({ matrix }: Props): ReactElement {
  const monoFont = "var(--mono, 'JetBrains Mono'), ui-monospace, monospace"

  const maxAbs = Math.max(
    ...matrix.rows.flatMap(r => r.cells.map(c => Math.abs(c.v))),
    1,
  )

  function cellBg(v: number, trades: number): string {
    if (trades === 0) return "var(--color-surface)"
    const o = (0.12 + (Math.abs(v) / maxAbs) * 0.34).toFixed(2)
    return v >= 0 ? `rgba(34,197,94,${o})` : `rgba(239,68,68,${o})`
  }

  return (
    <div className="card" style={{ padding: 0 }}>
      <div
        style={{
          padding:      "12px 16px",
          borderBottom: "1px solid var(--color-border)",
          display:      "flex",
          alignItems:   "center",
        }}
      >
        <div
          style={{
            fontSize: 9, fontWeight: 500, letterSpacing: "0.1em",
            color: "var(--color-text-mute)", textTransform: "uppercase",
          }}
        >
          {REPORTS.TIME.HEATMAP_LABEL}
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th
                style={{
                  padding:      "9px 14px",
                  textAlign:    "left",
                  position:     "sticky",
                  left:         0,
                  background:   "var(--color-surface)",
                  borderBottom: "1px solid var(--color-border)",
                }}
              />
              {matrix.hours.map(h => (
                <th
                  key={h}
                  style={{
                    padding:       "9px 10px",
                    textAlign:     "right",
                    fontFamily:    monoFont,
                    fontSize:      10,
                    fontWeight:    500,
                    color:         "var(--color-text-mute)",
                    borderBottom:  "1px solid var(--color-border)",
                    whiteSpace:    "nowrap",
                  }}
                >
                  {pad2(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map(row => (
              <tr key={row.weekday}>
                <td
                  style={{
                    padding:      "8px 14px",
                    position:     "sticky",
                    left:         0,
                    background:   "var(--color-surface)",
                    color:        "var(--color-text-mute)",
                    fontSize:     12,
                    fontWeight:   500,
                    whiteSpace:   "nowrap",
                    borderBottom: "1px solid var(--color-border)",
                  }}
                >
                  {row.label}
                </td>
                {row.cells.map(cell => (
                  <td
                    key={cell.hour}
                    title={`${row.label} ${pad2(cell.hour)}:00 · ${cell.trades} trades`}
                    style={{
                      padding:      "8px 10px",
                      textAlign:    "right",
                      background:   cellBg(cell.v, cell.trades),
                      borderBottom: "1px solid var(--color-border)",
                      borderLeft:   "1px solid var(--color-border)",
                    }}
                  >
                    <span
                      style={{
                        fontFamily:         monoFont,
                        fontSize:           10.5,
                        fontVariantNumeric: "tabular-nums",
                        color:              cell.trades === 0
                          ? "var(--color-text-mute)"
                          : cell.v >= 0
                            ? "var(--color-profit)"
                            : "var(--color-loss)",
                      }}
                    >
                      {cell.trades === 0 ? "·" : formatCompactCurrency(cell.v)}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
