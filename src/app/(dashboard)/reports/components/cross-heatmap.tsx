import type { ReactElement } from "react"
import type { CrossMatrix } from "~/types/reports"
import { REPORTS } from "~/constants/copies/reports"
import { formatCompactCurrency } from "~/helpers/format"

type Props = {
  cross: CrossMatrix
}

export function CrossHeatmap({ cross }: Props): ReactElement {
  const monoFont = "var(--mono, 'JetBrains Mono'), ui-monospace, monospace"

  const maxAbs = Math.max(
    ...cross.rows.flatMap(r => r.cells.map(c => Math.abs(c.v))),
    1,
  )

  function cellBg(v: number): string {
    if (v === 0) return "var(--color-surface)"
    const o = (0.12 + (Math.abs(v) / maxAbs) * 0.34).toFixed(2)
    return v > 0
      ? `rgba(34,197,94,${o})`
      : `rgba(239,68,68,${o})`
  }

  return (
    <div className="card" style={{ padding: 0 }}>
      <div
        style={{
          padding:        "12px 16px",
          borderBottom:   "1px solid var(--color-border)",
          display:        "flex",
          justifyContent: "space-between",
          alignItems:     "center",
        }}
      >
        <div
          style={{
            fontSize: 9, fontWeight: 500, letterSpacing: "0.1em",
            color: "var(--color-text-mute)", textTransform: "uppercase",
          }}
        >
          {REPORTS.REPORT_DETAIL.CROSS_LABEL}
        </div>
        <div
          style={{
            display:     "inline-flex",
            alignItems:  "center",
            gap:         7,
            padding:     "5px 9px",
            background:  "var(--color-surface)",
            border:      "1px solid var(--color-border)",
            borderRadius: 6,
            fontSize:    12,
            color:       "var(--color-text-mute)",
          }}
        >
          {REPORTS.REPORT_DETAIL.CROSS_MENU}
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 640 }}>
          <thead>
            <tr>
              <th
                style={{
                  padding:         "9px 14px",
                  textAlign:       "left",
                  position:        "sticky",
                  left:            0,
                  background:      "var(--color-surface)",
                  fontSize:        9,
                  fontWeight:      500,
                  letterSpacing:   "0.1em",
                  color:           "var(--color-text-mute)",
                  textTransform:   "uppercase",
                  borderBottom:    "1px solid var(--color-border)",
                }}
              />
              {cross.cols.map(col => (
                <th
                  key={col}
                  style={{
                    padding:       "9px 12px",
                    textAlign:     "right",
                    fontSize:      9,
                    fontWeight:    500,
                    letterSpacing: "0.1em",
                    color:         "var(--color-text-mute)",
                    textTransform: "uppercase",
                    borderBottom:  "1px solid var(--color-border)",
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cross.rows.map((row, ri) => (
              <tr key={ri}>
                <td
                  style={{
                    padding:    "8px 14px",
                    position:   "sticky",
                    left:       0,
                    background: "var(--color-surface)",
                    color:      "var(--color-text-mute)",
                    fontSize:   12,
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                    borderBottom: "1px solid var(--color-border)",
                  }}
                >
                  {row.label}
                </td>
                {row.cells.map((cell, ci) => (
                  <td
                    key={ci}
                    style={{
                      padding:      "8px 12px",
                      textAlign:    "right",
                      background:   cellBg(cell.v),
                      borderBottom: "1px solid var(--color-border)",
                      borderLeft:   "1px solid var(--color-border)",
                    }}
                  >
                    <span
                      style={{
                        fontFamily:         monoFont,
                        fontSize:           11,
                        fontVariantNumeric: "tabular-nums",
                        color:              cell.v === 0
                          ? "var(--color-text-mute)"
                          : cell.v > 0
                            ? "var(--color-profit)"
                            : "var(--color-loss)",
                      }}
                    >
                      {cell.v === 0 ? "$0" : formatCompactCurrency(cell.v)}
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
